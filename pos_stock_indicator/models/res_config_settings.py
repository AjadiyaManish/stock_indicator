# -*- coding: utf-8 -*-
from odoo import fields, models

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    pos_show_product_stock = fields.Boolean(
        related='pos_config_id.show_product_stock',
        readonly=False,
    )
    pos_low_stock_threshold = fields.Integer(
        related='pos_config_id.low_stock_threshold',
        readonly=False,
    )