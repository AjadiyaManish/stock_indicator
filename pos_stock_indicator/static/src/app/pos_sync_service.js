/** @odoo-module */

import { PosStore } from "@point_of_sale/app/services/pos_store";
import { patch } from "@web/core/utils/patch";

import { reactive } from "@odoo/owl";

patch(PosStore.prototype, {
    async setup() {
        await super.setup(...arguments);
        this.onDemandCart = reactive({});
        this.syncIncomingQuantities();
        setInterval(() => {
            this.syncIncomingQuantities();
        }, 10000);
    },

    async syncIncomingQuantities() {
        try {
            const context = {
                warehouse: this.config.warehouse_id?.[0] || this.config.warehouse_id || false,
            };

            // Fetch Incoming Quantities from PO Lines
            const domain = [['order_id.state', 'in', ['purchase', 'done']]];
            const fields = ['product_id', 'order_id', 'product_qty', 'qty_received'];
            const lines = await this.data.execute({
                type: 'call',
                model: 'purchase.order.line',
                method: 'search_read',
                args: [domain, fields],
            });

            // Fetch Latest On-Hand Stock with Warehouse Context
            const stockData = await this.data.execute({
                type: 'call',
                model: 'product.product',
                method: 'search_read',
                args: [[['available_in_pos', '=', true]], ['id', 'qty_available', 'product_tmpl_id']],
                kwargs: { context: context }
            });

            const incomingMap = {};
            const tmplIncomingMap = {};
            const stockMap = {};
            const tmplStockMap = {};

            // Prepare Stock mapping
            stockData.forEach(s => {
                stockMap[s.id] = s.qty_available;
                const tid = s.product_tmpl_id?.[0] || s.product_tmpl_id;
                if (tid) {
                    tmplStockMap[tid] = (tmplStockMap[tid] || 0) + s.qty_available;
                }
            });

            // Prepare Incoming qty mapping bro
            for (const line of lines) {
                if (!line.product_id) continue;
                const pid = line.product_id[0];
                const rem = line.product_qty - line.qty_received;
                if (rem > 0) {
                    incomingMap[pid] = (incomingMap[pid] || 0) + rem;

                    const productModel = this.models["product.product"];
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

            this.pos_incoming_qtys = incomingMap;
            this.pos_tmpl_incoming_qtys = tmplIncomingMap;

            if (this.models["product.product"]) {
                this.models["product.product"].getAll().forEach(p => {
                    // Update Incoming (Receive Badge)
                    p.pos_incoming_qty = incomingMap[p.id] || 0;

                    // Update On Hand (Real-time sync)
                    if (stockMap[p.id] !== undefined) {
                        p.qty_available = stockMap[p.id];
                    }
                });
            }

            // Push updates to Templates
            if (this.models["product.template"]) {
                this.models["product.template"].getAll().forEach(t => {
                    // Update Incoming
                    t.pos_incoming_qty = tmplIncomingMap[t.id] || 0;

                    // Update On Hand
                    if (tmplStockMap[t.id] !== undefined) {
                        t.qty_available = tmplStockMap[t.id];
                    }
                });
            }

        } catch (error) {
            console.error("POS Background Sync Error:", error);
        }
    }
});