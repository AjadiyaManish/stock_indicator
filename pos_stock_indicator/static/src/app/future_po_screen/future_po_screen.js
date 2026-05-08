/** @odoo-module */

import { registry } from "@web/core/registry";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { Component, onWillStart, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { Orderline } from "@point_of_sale/app/components/orderline/orderline";
import { useService } from "@web/core/utils/hooks";

export class FuturePOScreen extends Component {
    static template = "pos_product_stock_indicator.FuturePOScreen";
    static components = { Orderline };
    static props = {};

    setup() {
        this.pos = usePos();
        this.ui = useService("ui");
        this.state = useState({
            orders: [],
            selectedOrder: null,
            orderLines: [],
            loading: true,
        });

        onWillStart(async () => {
            await this.fetchPurchaseOrders();
        });
    }

    async fetchPurchaseOrders() {
        this.state.loading = true;
        try {
            const domain = [['order_id.state', 'in', ['purchase', 'done']]];
            const fields = ['product_id', 'order_id', 'partner_id', 'product_qty', 'qty_received', 'date_planned'];
            const lines = await this.pos.data.execute({
                type: 'call',
                model: 'purchase.order.line',
                method: 'search_read',
                args: [domain, fields],
                kwargs: { order: 'date_planned asc' }
            });
            this.state.orders = lines;

            // Sync maps for variants and templates
            const incomingMap = {};
            const tmplIncomingMap = {};

            for (const line of lines) {
                if (!line.product_id) continue;
                const pid = line.product_id[0];
                const rem = line.product_qty - line.qty_received;
                if (rem > 0) {
                    incomingMap[pid] = (incomingMap[pid] || 0) + rem;

                    // Link to template 
                    const productModel = this.pos.models["product.product"];
                    if (productModel) {
                        const product = productModel.get(pid);
                        if (product) {
                            const tid = product.product_tmpl_id?.[0] || product.product_tmpl_id?.id || product.product_tmpl_id || product._raw?.product_tmpl_id;
                            if (tid && typeof tid === 'number') {
                                tmplIncomingMap[tid] = (tmplIncomingMap[tid] || 0) + rem;
                            }
                        }
                    }
                }
            }

            this.pos.pos_incoming_qtys = incomingMap;
            this.pos.pos_tmpl_incoming_qtys = tmplIncomingMap;

            if (this.pos.models["product.product"]) {
                this.pos.models["product.product"].getAll().forEach(p => {
                    if (incomingMap[p.id] !== undefined) {
                        p.pos_incoming_qty = incomingMap[p.id];
                    }
                });
            }
            if (this.pos.models["product.template"]) {
                this.pos.models["product.template"].getAll().forEach(t => {
                    if (tmplIncomingMap[t.id] !== undefined) {
                        t.pos_incoming_qty = tmplIncomingMap[t.id];
                    }
                });
            }
        } catch (error) {
            console.error("Error fetching PO lines:", error);
        } finally {
            this.state.loading = false;
        }
    }

    async onClickOrder(line) {
        this.state.selectedOrder = line;
    }

    onBack() {
        this.pos.navigate("ProductScreen");
    }

    formatCurrency(amount) {
        return this.env.utils.formatCurrency(amount);
    }

    getDate(dateStr) {
        if (!dateStr) return '';
        return dateStr.split(' ')[0];
    }
}

registry.category("pos_pages").add("FuturePOScreen", {
    name: "FuturePOScreen",
    component: FuturePOScreen,
    route: `/pos/ui/${odoo.pos_config_id}/future_po`,
});
