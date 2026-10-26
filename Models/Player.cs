using System.ComponentModel.DataAnnotations;

namespace LongBets.Models;

/// <summary>
/// Spillerens saldo og profil i LongBets. Selve login (e-mail, Google-konto) ligger i ASP.NET Identity-tabellerne.
/// UserId er bevidst ikke en fremmednøgle til AspNetUsers: så kan login senere flyttes til en fælles
/// database for alle villadsclaes.dk-projekter, mens spillets data bliver her.
/// </summary>
public class Player
{
    public const int StartBalance = 1000;
    public const int DailyBonus = 100;

    [Key]
    [StringLength(450)]
    public string UserId { get; set; } = "";

    [Required(ErrorMessage = "Du skal have et navn at prale med.")]
    [StringLength(60, MinimumLength = 2, ErrorMessage = "Mellem 2 og 60 tegn.")]
    [Display(Name = "Kaldenavn")]
    public string DisplayName { get; set; } = "";

    public int Balance { get; set; } = StartBalance;

    public DateOnly? LastBonus { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
