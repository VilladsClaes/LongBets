using LongBets.Models;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Bet> Bets => Set<Bet>();
    public DbSet<Stake> Stakes => Set<Stake>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Bet>(b =>
        {
            b.Property(x => x.Category).HasConversion<string>().HasMaxLength(20);
            b.Property(x => x.Outcome).HasConversion<string>().HasMaxLength(10);
            b.HasMany(x => x.Stakes).WithOne(x => x.Bet!).HasForeignKey(x => x.BetId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
