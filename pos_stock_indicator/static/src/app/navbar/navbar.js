import { Navbar } from "@point_of_sale/app/components/navbar/navbar";
import { patch } from "@web/core/utils/patch";
import { OnDemandCartDialog } from "../on_demand_cart_dialog";

patch(Navbar.prototype, {
    setup() {
        super.setup?.();
        this.dialog = this.env.services.dialog;
    },
    onClickFuturePO() {
        this.pos.navigate("FuturePOScreen");
    },
    onClickOnDemandCart() {
        this.dialog.add(OnDemandCartDialog, {});
    },
    get onDemandCartCount() {
        if (!this.pos.onDemandCart) return 0;
        return Object.values(this.pos.onDemandCart).reduce((sum, item) => sum + item.qty, 0);
    },
    get mainButton() {
        if (this.pos.router.state.current === "FuturePOScreen") {
            return "future_po";
        }
        return super.mainButton;
    },
});
