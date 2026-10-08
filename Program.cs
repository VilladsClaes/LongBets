using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using System.Threading.RateLimiting;
using LongBets.Data;
using LongBets.News;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.WebEncoders;

var builder = WebApplication.CreateBuilder(args);

// Danske tal og datoer overalt (1.000 PK, 2,35 i odds, "8. oktober 2026").
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.DefaultThreadCurrentUICulture = new CultureInfo("da-DK");

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' mangler.");

// SQLite-filen ligger i App_Data, som skal være skrivbar på serveren.
Directory.CreateDirectory(Path.Combine(builder.Environment.ContentRootPath, "App_Data"));

builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddControllersWithViews();

// Nyhedsimport fra danske medier, se News/NewsSources.cs.
builder.Services.AddHttpClient(NewsImporter.HttpClientName, http =>
{
    http.Timeout = TimeSpan.FromSeconds(15);
    http.MaxResponseContentBufferSize = 10 * 1024 * 1024;
    http.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; LongBets/1.0; +https://longbets.villadsclaes.dk)");
    http.DefaultRequestHeaders.Accept.ParseAdd("application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5");
});
builder.Services.AddScoped<NewsImporter>();
builder.Services.AddSingleton<NewsRefreshService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<NewsRefreshService>());

// Admin-login: én adgangskode fra konfigurationen (Admin:Password), gemt i en cookie.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(o =>
    {
        o.LoginPath = "/Admin/Login";
        o.LogoutPath = "/Admin/Logout";
        o.AccessDeniedPath = "/Admin/Login";
        o.Cookie.Name = "LongBets.Admin";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Strict;
        o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        o.ExpireTimeSpan = TimeSpan.FromHours(8);
        o.SlidingExpiration = true;
    });
builder.Services.AddAuthorization();

// Bremser gætteri på admin-adgangskoden: 5 forsøg pr. minut pr. IP.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "ukendt",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
});
// Skriv æ, ø og å direkte i HTML i stedet for &#xE6; osv.
builder.Services.Configure<WebEncoderOptions>(o => o.TextEncoderSettings = new TextEncoderSettings(UnicodeRanges.All));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    SeedData.Initialize(db);
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseStatusCodePagesWithReExecute("/Home/Error", "?statusCode={0}");
app.UseHttpsRedirection();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapStaticAssets();
app.MapControllerRoute(
        name: "default",
        pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
