# -*- coding: utf-8 -*-
from odoo import models, fields

class ProductProduct(models.Model):
    _inherit = 'product.product'

    pos_incoming_qty = fields.Float(string='POS Incoming Qty', default=0.0)

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    pos_incoming_qty = fields.Float(string='POS Incoming Qty', default=0.0)