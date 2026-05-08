# -*- coding: utf-8 -*-
from odoo import fields, models

class PosConfig(models.Model):
    _inherit = 'pos.config'

    show_product_stock = fields.Boolean(
        string='Show Product Stock in POS',
        default=True,
        help='Displays the real-time stock quantity natively on the product card within the POS interface.'
    )
    low_stock_threshold = fields.Integer(
        string='Low Stock Threshold',
        default=5,
        help='When the stock quantity drops to or below this amount, the badge will show a low stock warning.'
    )