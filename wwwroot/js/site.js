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

// Opret bet ud fra et link: hent artiklens titel og billede og foreslå en påstand.
document.querySelectorAll("[data-link-preview]").forEach(function (field) {
    var input = field.querySelector('input[name="link"]');
    var button = field.querySelector("[data-link-fetch]");
    var result = field.querySelector("[data-link-result]");

    function show(nodes) {
        result.replaceChildren.apply(result, nodes);
        result.hidden = nodes.length === 0;
    }

    function fetchMeta() {
        if (!input.value.trim()) return show([]);
        button.disabled = true;
        show([document.createTextNode("Henter …")]);
        fetch("/Bets/LinkMeta?url=" + encodeURIComponent(input.value.trim()))
            .then(function (r) { return r.ok ? r.json() : { error: "Prøv igen om lidt." }; })
            .then(function (meta) {
                if (meta.error) return show([document.createTextNode(meta.error)]);
                var nodes = [];
                if (meta.image) {
                    var img = document.createElement("img");
                    img.src = meta.image;
                    img.alt = "";
                    img.referrerPolicy = "no-referrer";
                    nodes.push(img);
                }
                var text = document.createElement("div");
                var strong = document.createElement("strong");
                strong.textContent = meta.title || meta.site;
                text.append(strong, document.createElement("br"), document.createTextNode(meta.site));
                nodes.push(text);
                show(nodes);

                var title = document.querySelector('input[name="Title"]');
                if (title && !title.value && meta.title) {
                    var suggestion = "Om et år kan ingen huske det her: »" + meta.title + "«";
                    title.value = suggestion.length > 140 ? suggestion.slice(0, 139) + "…" : suggestion;
                }
            })
            .catch(function () { show([document.createTextNode("Kunne ikke hente siden.")]); })
            .finally(function () { button.disabled = false; });
    }

    button.addEventListener("click", fetchMeta);
    input.addEventListener("change", fetchMeta);
});
