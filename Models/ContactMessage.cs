using System.ComponentModel.DataAnnotations;

namespace LongBets.Models;

public class ContactMessage
{
    public int Id { get; set; }

    [Required(ErrorMessage = "Navn, tak.")]
    [StringLength(80)]
    [Display(Name = "Navn")]
    public string Name { get; set; } = "";

    [Required(ErrorMessage = "Vi skal bruge en e-mail at ignorere.")]
    [EmailAddress(ErrorMessage = "Det ligner ikke en e-mail.")]
    [StringLength(200)]
    [Display(Name = "E-mail")]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "Skriv noget. Hvad som helst.")]
    [StringLength(2000)]
    [Display(Name = "Besked")]
    public string Message { get; set; } = "";

    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    public bool IsRead { get; set; }
}
