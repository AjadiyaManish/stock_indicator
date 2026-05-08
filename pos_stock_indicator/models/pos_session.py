# -*- coding: utf-8 -*-
from odoo import models, api, fields
import logging

_logger = logging.getLogger(__name__)

class PosSession(models.Model):
    _inherit = 'pos.session'

    def _loader_params_pos_config(self):
        params = super()._loader_params_pos_config()
        params['search_params']['fields'].extend(['show_product_stock', 'low_stock_threshold'])
        return params

    def load_data(self, models_to_load):
        response = super().load_data(models_to_load)
        
        # We don't strictly need to inject them here if they are in loader_params, 
        # but keeping it for compatibility with the existing logic if any.
        if 'pos.config' in response:
            for config in response['pos.config']:
                config['show_product_stock'] = bool(self.config_id.show_product_stock)
                config['low_stock_threshold'] = int(self.config_id.low_stock_threshold)

        incoming_info_prod = {}
        # Get all relevant product IDs in the session
        product_ids = []
        if 'product.product' in response:
            product_ids += [p['id'] for p in response['product.product']]
        
        if product_ids:
            #  fetch confirmed PO lines for ALL products at once
            lines = self.env['purchase.order.line'].sudo().search([
                ('product_id', 'in', product_ids),
                ('order_id.state', 'in', ['purchase', 'done']),
                ('state', 'not in', ['cancel', 'draft'])
            ])
            for line in lines:
                needed = line.product_qty - line.qty_received
                if needed > 0:
                    incoming_info_prod[line.product_id.id] = incoming_info_prod.get(line.product_id.id, 0.0) + needed

        #  update the response with the calculated quantities
        if 'product.product' in response:
            products = self.env['product.product'].sudo().with_context(warehouse=self.config_id.warehouse_id.id).browse(product_ids)
            stock_info_prod = {p.id: p.qty_available for p in products}
            
            for p_data in response['product.product']:
                pid = p_data['id']
                p_data['qty_available'] = stock_info_prod.get(pid, 0.0)
                p_data['pos_incoming_qty'] = incoming_info_prod.get(pid, 0.0)

        if 'product.template' in response:
            template_ids = [t['id'] for t in response['product.template']]
            templates = self.env['product.template'].sudo().with_context(warehouse=self.config_id.warehouse_id.id).browse(template_ids)
            stock_info_tmpl = {t.id: t.qty_available for t in templates}

            for p_data in response['product.template']:
                tid = p_data['id']
                tmpl = templates.filtered(lambda x: x.id == tid)
                t_incoming = 0.0
                if tmpl:
                    t_incoming = sum(incoming_info_prod.get(v.id, 0.0) for v in tmpl.product_variant_ids)
                
                p_data['qty_available'] = stock_info_tmpl.get(tid, 0.0)
                p_data['pos_incoming_qty'] = t_incoming
                
        return response