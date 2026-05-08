/** @odoo-module */

import { ProductProduct } from "@point_of_sale/app/models/product_product";
import { ProductTemplate } from "@point_of_sale/app/models/product_template";
import { patch } from "@web/core/utils/patch";

patch(ProductProduct.prototype, {
    setup(record) {
        super.setup(...arguments);
        this.pos_incoming_qty = record.pos_incoming_qty || 0;
    }
});

patch(ProductTemplate.prototype, {
    setup(record) {
        super.setup(...arguments);
        this.pos_incoming_qty = record.pos_incoming_qty || 0;
    }
});
