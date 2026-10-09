using System.Security.Claims;
using LongBets.Data;
using LongBets.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Accounts;

/// <summary>Den indloggede spiller, saldo og daglig bonus.</summary>
public class PlayerService(AppDbContext db, UserManager<IdentityUser> users, IHttpContextAccessor http)
{
    private Player? current;
    private bool loaded;

    /// <summary>Sat, hvis denne forespørgsel lige har udløst dagens bonus, så layoutet kan sige det.</summary>
    public bool BonusGranted { get; private set; }

    /// <summary>Den indloggede spiller, eller null. Udløser dagens bonus ved første besøg i døgnet.</summary>
    public async Task<Player?> CurrentAsync()
    {
        if (loaded) return current;
        loaded = true;

        var principal = http.HttpContext?.User;
        var userId = principal is null ? null : users.GetUserId(principal);
        if (userId is null) return null;

        var player = await db.Players.FirstOrDefaultAsync(p => p.UserId == userId);
        if (player is null)
        {
            var user = await users.FindByIdAsync(userId);
            if (user is null) return null;
            player = await EnsureAsync(user.Id, user.Email ?? user.UserName ?? "Spiller");
        }

        var today = DateOnly.FromDateTime(DateTime.Now);
        if (player.LastBonus != today)
        {
            // Betingelsen i WHERE sikrer, at to samtidige forespørgsler ikke begge giver bonus.
            var granted = await db.Players
                .Where(p => p.UserId == userId && (p.LastBonus == null || p.LastBonus != today))
                .ExecuteUpdateAsync(u => u
                    .SetProperty(p => p.Balance, p => p.Balance + Player.DailyBonus)
                    .SetProperty(p => p.LastBonus, today));
            if (granted > 0)
            {
                BonusGranted = true;
                await db.Entry(player).ReloadAsync();
            }
        }

        return current = player;
    }

    /// <summary>Opretter spilleren første gang en bruger logger ind. Navnet kan rettes bagefter.</summary>
    public async Task<Player> EnsureAsync(string userId, string suggestedName)
    {
        var player = await db.Players.FirstOrDefaultAsync(p => p.UserId == userId);
        if (player is not null) return player;

        var name = suggestedName.Contains('@') ? suggestedName[..suggestedName.IndexOf('@')] : suggestedName;
        name = name.Trim();
        if (name.Length < 2) name = "Anonym profet";
        if (name.Length > 60) name = name[..60];

        // Første dag får man startkapitalen, ikke også en bonus oveni.
        player = new Player { UserId = userId, DisplayName = name, LastBonus = DateOnly.FromDateTime(DateTime.Now) };
        db.Players.Add(player);
        await db.SaveChangesAsync();
        return player;
    }

    /// <summary>
    /// Trækker en indsats fra saldoen. Returnerer false, hvis der ikke er penge nok.
    /// Skal køre i samme transaktion som oprettelsen af indsatsen.
    /// </summary>
    public async Task<bool> TryWithdrawAsync(string userId, int amount) =>
        await db.Players
            .Where(p => p.UserId == userId && p.Balance >= amount)
            .ExecuteUpdateAsync(u => u.SetProperty(p => p.Balance, p => p.Balance - amount)) > 0;

    public static string? NameFromClaims(ClaimsPrincipal principal) =>
        principal.FindFirstValue(ClaimTypes.Name)
        ?? principal.FindFirstValue(ClaimTypes.GivenName)
        ?? principal.FindFirstValue(ClaimTypes.Email);
}
