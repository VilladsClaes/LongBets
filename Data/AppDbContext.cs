using LongBets.Models;
using Microsoft.EntityFrameworkCore;

namespace LongBets.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Bet> Bets => Set<Bet>();
    public DbSet<Stake> Stakes => Set<Stake>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<NewsItem> NewsItems => Set<NewsItem>();
    public DbSet<FeedState> FeedStates => Set<FeedState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Bet>(b =>
        {
            b.Property(x => x.Category).HasConversion<string>().HasMaxLength(20);
            b.Property(x => x.Outcome).HasConversion<string>().HasMaxLength(10);
            b.HasMany(x => x.Stakes).WithOne(x => x.Bet!).HasForeignKey(x => x.BetId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<NewsItem>(n =>
        {
            n.Property(x => x.Source).HasMaxLength(30);
            n.Property(x => x.Title).HasMaxLength(300);
            n.Property(x => x.Url).HasMaxLength(1000);
            n.Property(x => x.Summary).HasMaxLength(500);
            n.HasIndex(x => x.Url).IsUnique();
            n.HasIndex(x => x.PublishedAt);
            n.Ignore(x => x.SortTime);
        });

        modelBuilder.Entity<FeedState>(f =>
        {
            f.HasKey(x => x.Source);
            f.Property(x => x.Source).HasMaxLength(30);
            f.Property(x => x.Error).HasMaxLength(200);
        });
    }
}
