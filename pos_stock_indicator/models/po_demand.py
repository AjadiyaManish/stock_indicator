# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import UserError

class PoDemand(models.Model):
    _name = 'po.demand'
    _description = 'Purchase On Demand'

    name = fields.Char(string='Reference', required=True, copy=False, readonly=True, index=True, default=lambda self: 'New')
    state = fields.Selection([
        ('draft', 'Draft'),
        ('confirm', 'Confirmed'),
        ('cancel', 'Cancelled'),
    ], string='Status', default='draft', readonly=True)
    line_ids = fields.One2many('po.demand.line', 'demand_id', string='Order Lines')
    purchase_ids = fields.One2many('purchase.order', 'po_demand_id', string='Generated Purchase Orders')
    purchase_count = fields.Integer(string='Purchase Order Count', compute='_compute_purchase_count')

    @api.depends('purchase_ids')
    def _compute_purchase_count(self):
        for record in self:
            record.purchase_count = len(record.purchase_ids)

    def action_view_purchase_orders(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id("purchase.purchase_form_action")
        if self.purchase_count > 1:
            action['domain'] = [('id', 'in', self.purchase_ids.ids)]
        elif self.purchase_count == 1:
            action['views'] = [(self.env.ref('purchase.purchase_order_form').id, 'form')]
            action['res_id'] = self.purchase_ids.id
        else:
            action = {'type': 'ir.actions.act_window_close'}
        return action

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') in ['New', 'New Demand']:
                vals['name'] = self.env['ir.sequence'].next_by_code('po.demand') or 'New'
        return super(PoDemand, self).create(vals_list)

    def action_confirm(self):
        self.ensure_one()
        if not self.line_ids:
            return

        # Group lines by vendor
        vendor_lines = {}
        
        fallback_vendor = self.env['res.partner']
        for line in self.line_ids:
            if line.vendor_id:
                fallback_vendor = line.vendor_id
                break
            if line.product_id.seller_ids:
                fallback_vendor = line.product_id.seller_ids[0].partner_id
                break
        
        if not fallback_vendor:
            fallback_vendor = self.env['res.partner'].search([], limit=1)

        if not fallback_vendor:
            raise UserError("No partner/vendor found in the system. Please create at least one contact.")

        for line in self.line_ids:
            vendor = line.vendor_id
            if not vendor and line.product_id.seller_ids:
                vendor = line.product_id.seller_ids[0].partner_id
            if not vendor:
                vendor = fallback_vendor

            if vendor not in vendor_lines:
                vendor_lines[vendor] = []
            vendor_lines[vendor].append(line)

        purchase_orders = self.env['purchase.order']
        for vendor, lines in vendor_lines.items():

            po_vals = {
                'partner_id': vendor.id,
                'po_demand_id': self.id,
                'order_line': [(0, 0, {
                    'product_id': l.product_id.id,
                    'product_qty': l.qty,
                    'price_unit': l.price or l.product_id.standard_price,
                    'date_planned': fields.Datetime.now(),
                }) for l in lines],
            }
            purchase_orders |= self.env['purchase.order'].create(po_vals)

        self.write({
            'state': 'confirm'
        })


    def action_cancel(self):
        self.write({'state': 'cancel'})

class PoDemandLine(models.Model):
    _name = 'po.demand.line'
    _description = 'Purchase On Demand Line'

    demand_id = fields.Many2one('po.demand', string='Demand Reference', required=True, ondelete='cascade')
    product_id = fields.Many2one('product.product', string='Product Name', required=True)
    vendor_id = fields.Many2one('res.partner', string='Vendor')
    qty = fields.Float(string='Qty', default=1.0)
    price = fields.Float(string='Price')

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.product_id and self.product_id.seller_ids:
            self.vendor_id = self.product_id.seller_ids[0].partner_id

class PurchaseOrder(models.Model):
    _inherit = 'purchase.order'

    po_demand_id = fields.Many2one('po.demand', string='Generated From Demand')