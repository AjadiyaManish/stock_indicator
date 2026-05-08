/** @odoo-module */

import { ProductCard } from "@point_of_sale/app/components/product_card/product_card";
import { patch } from "@web/core/utils/patch";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import OrderPaymentValidation from "@point_of_sale/app/utils/order_payment_validation";

import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
import { Component } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

export class VariantSelectionDialog extends Component {
    static template = "pos_product_stock_indicator.VariantSelectionDialog";
    static components = { Dialog };

    selectVariant(variant) {
        this.props.onConfirm(variant);
        this.props.close();
    }
}

patch(ProductCard.prototype, {
    setup() {
        super.setup?.();
        this.pos = usePos();
        this.dialog = this.env.services.dialog;

        // Global hiding helper
        document.body.classList.toggle('hide-all-pos-stock', !this.show_stock);
    },

    onProductClick(ev) {
        const clickedOnDemand = ev && ev.target && ev.target.closest('.on-demand-badge');

        if (clickedOnDemand) {
            ev.stopPropagation();
            const product = this.props.product;

            const doAdd = (prod) => {
                const pid = prod.id;
                if (!this.pos.onDemandCart) {
                    this.pos.onDemandCart = {};
                }
                if (!this.pos.onDemandCart[pid]) {
                    this.pos.onDemandCart[pid] = { product: prod, qty: 0 };
                }
                this.pos.onDemandCart[pid].qty += 1;

                if (this.env.services.notification) {
                    this.env.services.notification.add(
                        `${prod.display_name || prod.name} added to On Demand Cart`,
                        { type: "success" }
                    );
                }
            };

            const isTemplate = this.pos.models["product.template"] && this.pos.models["product.template"].get(product.id) === product;
            const hasTmplId = product.product_tmpl_id || product._raw?.product_tmpl_id || product.raw?.product_tmpl_id;

            let variants = [];
            if ((isTemplate || !hasTmplId) && product.product_variant_ids && product.product_variant_ids.length > 1) {
                if (this.pos.models["product.product"]) {
                    variants = product.product_variant_ids.map(id => {
                        const vId = typeof id === 'object' ? (id.id || id[0]) : id;
                        return this.pos.models["product.product"].get(vId) || this.pos.models["product.product"].getAll().find(p => p.id === vId);
                    }).filter(Boolean);
                }
            }

            if (variants.length > 1) {
                this.dialog.add(VariantSelectionDialog, {
                    variants: variants,
                    onConfirm: (selectedVariant) => {
                        doAdd(selectedVariant);
                    }
                });
            } else {
                doAdd(product);
            }
            return;
        }

        if (this.show_stock && this.stock_qty <= 0) {
            this.dialog.add(AlertDialog, {
                title: _t("Out of Stock"),
                body: _t("This product is not available. Click '✦ ON DEMAND' to add it to On Demand Cart."),
            });
            return;
        }

        if (typeof this.props.onClick === 'function') {
            this.props.onClick(ev);
        }
    },

    get stock_qty() {
        const product = this.props.product;
        if (!product) return 0;

        let qty = product.qty_available;
        if (qty === undefined && product._raw) {
            qty = product._raw.qty_available;
        } else if (qty === undefined && product.raw) {
            qty = product.raw.qty_available;
        }

        let availableQty = qty !== undefined ? qty : 0;

        if (this.props.productCartQty) {
            availableQty -= this.props.productCartQty;
        }

        return availableQty;
    },

    get incoming_qty() {
        const product = this.props.product;
        if (!product) return 0;

        const pid = product.id;
        if (!pid) return 0;

        if (this.pos?.pos_incoming_qtys && this.pos.pos_incoming_qtys[pid] !== undefined) {
            return Math.max(0, this.pos.pos_incoming_qtys[pid]);
        }

        if (this.pos?.pos_tmpl_incoming_qtys && this.pos.pos_tmpl_incoming_qtys[pid] !== undefined) {
            return Math.max(0, this.pos.pos_tmpl_incoming_qtys[pid]);
        }

        const tid = product.product_tmpl_id?.[0] || product.product_tmpl_id?.id || product.product_tmpl_id || product._raw?.product_tmpl_id || product.raw?.product_tmpl_id;
        if (tid && this.pos?.pos_tmpl_incoming_qtys && this.pos.pos_tmpl_incoming_qtys[tid] !== undefined) {
            return Math.max(0, this.pos.pos_tmpl_incoming_qtys[tid]);
        }

        const directQty = product.pos_incoming_qty || product._raw?.pos_incoming_qty || product.raw?.pos_incoming_qty || 0;
        return Math.max(0, directQty);
    },

    get has_low_stock() {
        const threshold = this.pos?.config?.low_stock_threshold ?? 5;

        console.log(" this pos ============ : ", this.pos);
        console.log(" this pos conf============ : ", this.pos?.config);
        console.log(" threshold ============ : ", threshold);

        return this.stock_qty <= threshold;
    },

    get is_visible() {
        const product = this.props.product;
        if (!product) return false;

        return product.type !== "service";
    },

    get show_stock() {
        return !!this.pos?.config?.show_product_stock;
    }
});

patch(OrderPaymentValidation.prototype, {
    async finalizeValidation() {
        if (this.order && this.order.state !== "paid") {
            const lines = this.order.lines || this.order.get_orderlines?.() || [];
            for (const line of lines) {
                const lineProduct = line.product_id || line.product || line.getProduct?.();
                if (lineProduct) {
                    const lineQty = typeof line.getQuantity === "function" ? line.getQuantity() : (line.qty || 0);

                    // Update product quantity safely
                    if (lineProduct.qty_available !== undefined) {
                        lineProduct.qty_available -= lineQty;
                    }

                    // Update template quantity safely
                    const tmpl = lineProduct.product_tmpl_id;
                    if (tmpl && tmpl.qty_available !== undefined) {
                        tmpl.qty_available -= lineQty;
                    }
                }
            }
        }

        return await super.finalizeValidation();
    }
});