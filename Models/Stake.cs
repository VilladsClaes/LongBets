using System.ComponentModel.DataAnnotations;

namespace LongBets.Models;

public class Stake
{
    public int Id { get; set; }

    public int BetId { get; set; }
    public Bet? Bet { get; set; }

    [Required(ErrorMessage = "Skriv dit navn, så vi ved, hvem der skal ydmyges.")]
    [StringLength(60)]
    [Display(Name = "Kaldenavn")]
    public string PlayerName { get; set; } = "";

    /// <summary>True = satser på at påstanden holder, false = imod.</summary>
    public bool OnYes { get; set; }

    [Range(1, 10_000, ErrorMessage = "Mellem 1 og 10.000 Pralkroner. Vi er ikke en bank.")]
    [Display(Name = "Indsats (Pralkroner)")]
    public int Amount { get; set; }

    [StringLength(200)]
    [Display(Name = "Begrundelse (valgfri)")]
    public string? Reasoning { get; set; }

    public DateTime PlacedAt { get; set; } = DateTime.UtcNow;
}
