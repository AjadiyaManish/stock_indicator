/** @odoo-module */

import { Component } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";

export class OnDemandCartDialog extends Component {
    static template = "pos_product_stock_indicator.OnDemandCartDialog";
    static components = { Dialog };

    setup() {
        this.pos = usePos();
    }

    get cartItems() {
        if (!this.pos.onDemandCart) return [];

        const items = [];
        for (const [pid, item] of Object.entries(this.pos.onDemandCart)) {
            const product = item.product;
            if (product) {
                const price = (product.lst_price !== undefined) ? product.lst_price : (product.get_price ? product.get_price(null, 1) : 0);
                items.push({
                    id: pid,
                    name: product.display_name || product.name || 'Unknown Product',
                    qty: item.qty,
                    price: price,
                    total: item.qty * price
                });
            }
        }
        return items;
    }

    updateQty(pid, ev) {
        const qty = parseFloat(ev.target.value);
        if (this.pos.onDemandCart[pid]) {
            this.pos.onDemandCart[pid].qty = isNaN(qty) ? 1 : Math.max(1, qty);
        }
    }

    changeQty(pid, delta) {
        if (this.pos.onDemandCart[pid]) {
            const currentQty = this.pos.onDemandCart[pid].qty || 1;
            this.pos.onDemandCart[pid].qty = Math.max(1, currentQty + delta);
        }
    }

    get cartTotal() {
        return this.cartItems.reduce((acc, item) => acc + item.total, 0);
    }

    removeItem(pid) {
        if (this.pos.onDemandCart && this.pos.onDemandCart[pid]) {
            delete this.pos.onDemandCart[pid];
        }
    }

    async confirmCart() {
        const line_vals = [];
        for (const [pid, item] of Object.entries(this.pos.onDemandCart)) {
            const product = item.product;
            if (product) {
                let variant_id = product.id;

                const hasTmplId = product.product_tmpl_id || product._raw?.product_tmpl_id || product.raw?.product_tmpl_id;

                // If the product doesn't have a template ID, it is likely a template itself.
                // We need the variant ID (product.product) for the backend.
                if (!hasTmplId) {
                    if (product.product_variant_ids && product.product_variant_ids.length > 0) {
                        variant_id = typeof product.product_variant_ids[0] === 'object' ? (product.product_variant_ids[0].id || product.product_variant_ids[0][0]) : product.product_variant_ids[0];
                    } else if (product.product_variant_id) {
                        variant_id = typeof product.product_variant_id === 'object' ? (product.product_variant_id.id || product.product_variant_id[0]) : product.product_variant_id;
                    } else if (this.pos.models["product.product"]) {
                        const variant = this.pos.models["product.product"].getAll().find(p => {
                            const tId = p.product_tmpl_id?.[0] || p.product_tmpl_id?.id || p.product_tmpl_id || p._raw?.product_tmpl_id || p.raw?.product_tmpl_id;
                            return tId === product.id;
                        });
                        if (variant) {
                            variant_id = variant.id;
                        }
                    }
                }

                line_vals.push([0, 0, {
                    'product_id': variant_id,
                    'qty': item.qty,
                    'price': (product.lst_price !== undefined) ? product.lst_price : (product.get_price ? product.get_price(null, 1) : 0),
                }]);
            }
        }

        if (line_vals.length === 0) return;

        try {
            await this.env.services.orm.create("po.demand", [{
                line_ids: line_vals
            }]);

            if (this.env.services.notification) {
                this.env.services.notification.add("Purchase on Demand created successfully!", { type: "success" });
            }
        } catch (error) {
            console.error("Failed to create Purchase on Demand:", error);
            if (this.env.services.notification) {
                this.env.services.notification.add("Failed to create demand. Check console.", { type: "danger" });
            }
        }

        this.clearCart();
    }

    clearCart() {
        for (const pid of Object.keys(this.pos.onDemandCart)) {
            delete this.pos.onDemandCart[pid];
        }
        this.props.close();
    }
}