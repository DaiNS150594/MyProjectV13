using System.Text;

/// <summary>
/// Một nguồn CSS cho frontend: main.css + biến theme (:root) + CustomCss + UserCss.
/// </summary>
public static class InlineCssBundleBuilder
{
    public static async Task<string> BuildAsync(
        IWebHostEnvironment env,
        GeneralSiteSettings settings,
        CancellationToken cancellationToken = default)
    {
        var webRoot = ResolveWebRootPath(env);
        var mainCssPath = Path.Combine(webRoot, "css", "common", "main.css");
        var mainCss = File.Exists(mainCssPath)
            ? await File.ReadAllTextAsync(mainCssPath, cancellationToken).ConfigureAwait(false)
            : "";

        var theme = BuildThemeBlock(settings);
        var generated = (settings.CustomCss ?? "").Trim();
        var user = (settings.UserCss ?? "").Trim();

        var parts = new List<string>(4);
        if (!string.IsNullOrEmpty(mainCss)) parts.Add(mainCss);
        if (!string.IsNullOrEmpty(theme)) parts.Add(theme);
        if (!string.IsNullOrEmpty(generated)) parts.Add(generated);
        if (!string.IsNullOrEmpty(user)) parts.Add(user);

        return parts.Count == 0 ? "" : string.Join("\n\n", parts);
    }

    /// <summary>Giống logic resolve wwwroot trong GeneralSettingsApiController (chạy từ bin/Debug).</summary>
    private static string ResolveWebRootPath(IWebHostEnvironment env)
    {
        var startDir = AppContext.BaseDirectory;
        try
        {
            var dir = new DirectoryInfo(Path.GetFullPath(startDir));
            for (var i = 0; i < 10 && dir != null; i++, dir = dir.Parent)
            {
                if (!dir.Exists) break;
                var csprojs = dir.GetFiles("*.csproj", SearchOption.TopDirectoryOnly);
                if (csprojs.Length == 0) continue;
                var candidate = Path.Combine(dir.FullName, "wwwroot");
                if (Directory.Exists(candidate))
                    return candidate;
            }
        }
        catch
        {
            /* ignore */
        }

        if (!string.IsNullOrEmpty(env.WebRootPath))
            return env.WebRootPath;

        return Path.Combine(env.ContentRootPath, "wwwroot");
    }

    private static string BuildThemeBlock(GeneralSiteSettings s)
    {
        var font = (s.FontFamily ?? "").Replace("<", string.Empty).Replace(">", string.Empty).Trim();
        var primary = GeneralSiteSettingsService.SanitizeHex(s.PrimaryColor, "#1a1a2e");
        var secondary = GeneralSiteSettingsService.SanitizeHex(s.SecondaryColor, "#16213e");
        var accent = GeneralSiteSettingsService.SanitizeHex(s.AccentColor, "#e94560");

        var sb = new StringBuilder();
        sb.AppendLine(":root {");
        if (!string.IsNullOrEmpty(font))
            sb.AppendLine($"  --site-font-family: {font};");
        sb.AppendLine($"  --site-color-primary: {primary};");
        sb.AppendLine($"  --site-color-secondary: {secondary};");
        sb.AppendLine($"  --site-color-accent: {accent};");
        sb.Append('}');
        return sb.ToString();
    }
}
