using System.ComponentModel.DataAnnotations;

namespace LongBets.Models;

public enum BetCategory
{
    Samfund,
    Teknologi,
    Sport,
    Hverdag,
    Kosmos,
}

public enum BetOutcome
{
    Open,
    Yes,
    No,
}

public class Bet
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Et bet uden titel er bare en drøm.")]
    [StringLength(140, MinimumLength = 10, ErrorMessage = "Titlen skal være mellem 10 og 140 tegn.")]
    [Display(Name = "Påstand")]
    public string Title { get; set; } = "";

    [StringLength(1000)]
    [Display(Name = "Uddybning (valgfri)")]
    public string? Description { get; set; }

    [Display(Name = "Kategori")]
    public BetCategory Category { get; set; }

    [Display(Name = "Afgøres senest")]
    [DataType(DataType.Date)]
    public DateOnly ResolvesOn { get; set; }

    [Required(ErrorMessage = "Hvem står bag? Vi skal vide, hvem vi skal grine af.")]
    [StringLength(60)]
    [Display(Name = "Dit kaldenavn")]
    public string CreatedBy { get; set; } = "";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public BetOutcome Outcome { get; set; } = BetOutcome.Open;

    public DateTime? ResolvedAt { get; set; }

    // Hvis bettet er lavet ud fra en nyhed. Kopieres ind, fordi nyhederne selv slettes efter en uge.
    [StringLength(1000)]
    public string? NewsUrl { get; set; }

    [StringLength(300)]
    public string? NewsTitle { get; set; }

    [StringLength(30)]
    public string? NewsSource { get; set; }

    public List<Stake> Stakes { get; set; } = [];
}
