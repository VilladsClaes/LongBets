// Kuponen: hurtigknapper og live-beregning af mulig gevinst.
document.querySelectorAll("[data-betslip]").forEach(function (form) {
    var amount = form.querySelector('input[name="NewStake.Amount"]');
    var payout = form.querySelector("[data-payout]");
    var odds = { "true": parseFloat(form.dataset.yesOdds), "false": parseFloat(form.dataset.noOdds) };
    var format = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

    function update() {
        var side = form.querySelector('input[name="NewStake.OnYes"]:checked');
        var value = parseInt(amount.value, 10);
        payout.textContent = side && value > 0 ? format.format(value * odds[side.value]) + " PK" : "–";
    }

    form.querySelectorAll("[data-amount]").forEach(function (btn) {
        btn.addEventListener("click", function () {
            amount.value = btn.dataset.amount;
            update();
        });
    });
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();
});

// Bekræftelse før handlinger, der ikke kan fortrydes (admin).
document.querySelectorAll("form[data-confirm]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
        if (!window.confirm(form.dataset.confirm)) e.preventDefault();
    });
});

// Opret bet ud fra en nyhed: skabelonknapperne fylder påstanden ud.
document.querySelectorAll("[data-template]").forEach(function (btn) {
    btn.addEventListener("click", function () {
        var title = document.querySelector('input[name="Title"]');
        if (!title) return;
        title.value = btn.dataset.template;
        title.focus();
    });
});
