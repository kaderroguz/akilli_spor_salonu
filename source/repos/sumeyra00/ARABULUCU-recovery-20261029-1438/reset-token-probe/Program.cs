using ARABULUCU.DAL.Data;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Text;

var services = new ServiceCollection();
services.AddLogging();
services.AddDataProtection().SetApplicationName("ARABULUCU");
services.AddDbContext<ApplicationDbContext>(options => options.UseSqlite($"Data Source={args[0]}"));
services.AddIdentity<IdentityUser, IdentityRole>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireDigit = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireNonAlphanumeric = false;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();
using var provider = services.BuildServiceProvider();
using var scope = provider.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
await db.Database.MigrateAsync();
var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
var user = await users.Users.FirstOrDefaultAsync() ?? throw new InvalidOperationException("No test user found.");
var token = await users.GeneratePasswordResetTokenAsync(user);
var encoded = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
var decoded = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(encoded));
Console.WriteLine($"token_roundtrip={token == decoded}");
var result = await users.ResetPasswordAsync(user, decoded, "ProbePassword123");
Console.WriteLine($"reset_succeeded={result.Succeeded}");
Console.WriteLine($"identity_errors={string.Join(',', result.Errors.Select(error => error.Code))}");
Console.WriteLine($"new_password_valid={await users.CheckPasswordAsync(user, "ProbePassword123")}");
