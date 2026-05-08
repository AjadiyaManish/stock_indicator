# -*- coding: utf-8 -*-
{
    'name': 'POS Real-Time Product Stock Indicator | Live Inventory Management System',
    'version': '19.0.1.0',
    'category': 'Sales/Point of Sale',
    'summary': 'Track product availability instantly with a POS Real-Time Product Stock Indicator. Manage live inventory, avoid stock-outs, and improve retail operations efficiently.',
    'description': """
        Revolutionize your POS inventory management:
        * POS Real-Time Product Stock Indicator.
        * Live Inventory Tracking.
        * POS Stock Management.
        * Retail Stock Indicator
        * Real-Time Inventory System.
    """,
    'depends': ['point_of_sale', 'purchase'],
    'data': [
        'data/ir_sequence_data.xml',
        'security/ir.model.access.csv',
        'views/po_demand_views.xml',
        'views/res_config_settings_views.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'pos_product_stock_indicator/static/src/app/**/*',
        ],
    },
    "installable": True,
    "images": ["static/description/banner.png"],
     'author': 'Envision Technolabs',
    'maintainer': 'Envision Technolabs',
    'website': 'https://www.envisiontechnolabs.com',
    "application": True,
    "auto_install": False,
    'license': 'OPL-1',
    'price': 10,
}
