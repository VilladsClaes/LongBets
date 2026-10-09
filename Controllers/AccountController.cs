using System.Security.Claims;
using LongBets.Accounts;
using LongBets.Data;
using LongBets.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Controllers;

public class AccountController(
    AppDbContext db,
    UserManager<IdentityUser> users,
    SignInManager<IdentityUser> signIn,
    PlayerService players,
    IWebHostEnvironment env,
    ILogger<AccountController> logger) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Login(string? returnUrl)
    {
        ViewBag.ReturnUrl = returnUrl;
        ViewBag.Providers = (await signIn.GetExternalAuthenticationSchemesAsync()).ToList();
        ViewBag.DevLogin = env.IsDevelopment();
        return View();
    }

    /// <summary>Sender brugeren videre til Google (eller en anden ekstern udbyder).</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> ExternalLogin(string provider, string? returnUrl)
    {
        var schemes = await signIn.GetExternalAuthenticationSchemesAsync();
        if (!schemes.Any(s => s.Name == provider)) return RedirectToAction(nameof(Login));

        var redirectUrl = Url.Action(nameof(ExternalLoginCallback), new { returnUrl });
        var properties = signIn.ConfigureExternalAuthenticationProperties(provider, redirectUrl);
        return Challenge(properties, provider);
    }

    [HttpGet]
    public async Task<IActionResult> ExternalLoginCallback(string? returnUrl, string? remoteError)
    {
        if (remoteError is not null)
        {
            logger.LogWarning("Eksternt login fejlede: {Error}", remoteError);
            TempData["Toast"] = "Login blev afbrudt. Prøv igen.";
            return RedirectToAction(nameof(Login), new { returnUrl });
        }

        var info = await signIn.GetExternalLoginInfoAsync();
        if (info is null) return RedirectToAction(nameof(Login), new { returnUrl });

        // Kendt Google-konto: log direkte ind.
        var result = await signIn.ExternalLoginSignInAsync(info.LoginProvider, info.ProviderKey, isPersistent: true, bypassTwoFactor: true);
        if (result.Succeeded)
        {
            var known = await users.FindByLoginAsync(info.LoginProvider, info.ProviderKey);
            if (known is not null) await players.EnsureAsync(known.Id, PlayerService.NameFromClaims(info.Principal) ?? known.Email ?? "Spiller");
            return LocalRedirect(SafeReturnUrl(returnUrl));
        }
        if (result.IsLockedOut || result.IsNotAllowed)
        {
            TempData["Toast"] = "Den konto må ikke logge ind lige nu.";
            return RedirectToAction(nameof(Login));
        }

        // Ny Google-konto. Findes e-mailen allerede (fx fra et senere e-mail-login), kobles Google på den bruger.
        var email = info.Principal.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrEmpty(email))
        {
            TempData["Toast"] = "Google sendte ingen e-mail, så vi kan ikke oprette en konto.";
            return RedirectToAction(nameof(Login));
        }

        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            user = new IdentityUser { UserName = email, Email = email, EmailConfirmed = true };
            var created = await users.CreateAsync(user);
            if (!created.Succeeded) return LoginFailed(created);
        }

        var linked = await users.AddLoginAsync(user, info);
        if (!linked.Succeeded) return LoginFailed(linked);

        await signIn.SignInAsync(user, isPersistent: true, info.LoginProvider);
        var player = await players.EnsureAsync(user.Id, PlayerService.NameFromClaims(info.Principal) ?? email);
        TempData["Toast"] = $"Velkommen, {player.DisplayName}. Her er {Player.StartBalance:N0} Pralkroner. Brug dem uklogt.";
        return LocalRedirect(SafeReturnUrl(returnUrl));
    }

    /// <summary>Kun under udvikling: log ind som en testspiller uden Google.</summary>
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> DevLogin(string name, string? returnUrl)
    {
        if (!env.IsDevelopment()) return NotFound();

        name = string.IsNullOrWhiteSpace(name) ? "Testspiller" : name.Trim();
        var email = $"{new string(name.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray())}@test.localhost";
        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            user = new IdentityUser { UserName = email, Email = email, EmailConfirmed = true };
            var created = await users.CreateAsync(user);
            if (!created.Succeeded) return LoginFailed(created);
        }
        await signIn.SignInAsync(user, isPersistent: true);
        await players.EnsureAsync(user.Id, name);
        return LocalRedirect(SafeReturnUrl(returnUrl));
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await signIn.SignOutAsync();
        TempData["Toast"] = "Du er logget ud. Dine Pralkroner venter trofast.";
        return RedirectToAction("Index", "Home");
    }

    /// <summary>Mine væddemål: saldo, åbne og afgjorte indsatser.</summary>
    [Authorize]
    public async Task<IActionResult> Mine()
    {
        var player = await players.CurrentAsync();
        if (player is null) return RedirectToAction(nameof(Login));

        // Med identity resolution, fordi indsatsen peger på bettet, som peger tilbage på alle indsatser.
        var stakes = await db.Stakes.AsNoTrackingWithIdentityResolution()
            .Where(s => s.UserId == player.UserId)
            .Include(s => s.Bet).ThenInclude(b => b!.Stakes)
            .OrderByDescending(s => s.PlacedAt)
            .ToListAsync();
        var created = await db.Bets.AsNoTracking()
            .Where(b => b.CreatedByUserId == player.UserId)
            .Include(b => b.Stakes)
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        return View(new MyBetsViewModel
        {
            Player = player,
            Stakes = stakes.Select(s => new MyStake(s, BetCard.From(s.Bet!))).ToList(),
            Created = created.Select(BetCard.From).ToList(),
        });
    }

    [Authorize]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Rename(string displayName)
    {
        var player = await players.CurrentAsync();
        if (player is null) return RedirectToAction(nameof(Login));

        var name = displayName?.Trim() ?? "";
        if (name.Length is < 2 or > 60)
        {
            TempData["Toast"] = "Kaldenavnet skal være mellem 2 og 60 tegn.";
            return RedirectToAction(nameof(Mine));
        }

        await db.Players.Where(p => p.UserId == player.UserId)
            .ExecuteUpdateAsync(u => u.SetProperty(p => p.DisplayName, name));
        TempData["Toast"] = $"Du hedder nu {name}. Nye indsatser bærer det navn.";
        return RedirectToAction(nameof(Mine));
    }

    private string SafeReturnUrl(string? returnUrl) =>
        Url.IsLocalUrl(returnUrl) ? returnUrl : Url.Action(nameof(Mine))!;

    private IActionResult LoginFailed(IdentityResult result)
    {
        logger.LogWarning("Kunne ikke oprette login: {Errors}", string.Join("; ", result.Errors.Select(e => e.Description)));
        TempData["Toast"] = "Kontoen kunne ikke oprettes. Prøv igen, eller skriv til os.";
        return RedirectToAction(nameof(Login));
    }
}
