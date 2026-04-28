using System.Text.Json;
using System.Text.RegularExpressions;

public class GeneralSiteSettingsService
{
    private const string FileName = "general-settings.json";
    private readonly IWebHostEnvironment _env;
    private readonly string _path;
    private readonly Lock _fileLock = new();

    internal static readonly JsonSerializerOptions JsonRead = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    private static readonly JsonSerializerOptions JsonWrite = new()
    {
        WriteIndented = true,
    };

    public GeneralSiteSettingsService(IWebHostEnvironment env)
    {
        _env = env;
        _path = ResolveConfigFilePath(env);
    }

    /// <summary>
    /// When running with F5 / IIS Express, the ContentRoot is typically bin\Debug\net10.0, so the Config\ file in the repo is not changed.
    /// Prefer the directory with both a .csproj file and a Config folder (by traversing upwards from BaseDirectory).
    /// When published (no .csproj present), fallback to using ContentRootPath/Config as before.
    /// </summary>
    private static string ResolveConfigFilePath(IWebHostEnvironment env)
    {
        if (TryFindSdkProjectConfigDirectory(AppContext.BaseDirectory, out var projectRoot))
            return Path.Combine(projectRoot, "Config", FileName);

        return Path.Combine(env.ContentRootPath, "Config", FileName);
    }

    private static bool TryFindSdkProjectConfigDirectory(string startDir, out string projectRoot)
    {
        projectRoot = "";
        try
        {
            var dir = new DirectoryInfo(Path.GetFullPath(startDir));
            for (var i = 0; i < 10 && dir != null; i++, dir = dir.Parent)
            {
                if (!dir.Exists) break;
                var configDir = Path.Combine(dir.FullName, "Config");
                if (!Directory.Exists(configDir)) continue;
                var csprojs = dir.GetFiles("*.csproj", SearchOption.TopDirectoryOnly);
                if (csprojs.Length == 0) continue;
                projectRoot = dir.FullName;
                return true;
            }
        }
        catch
        {
            /* dùng fallback ContentRoot */
        }

        return false;
    }

    public GeneralSiteSettings Get()
    {
        lock (_fileLock)
        {
            if (!File.Exists(_path))
                return new GeneralSiteSettings();

            try
            {
                var json = File.ReadAllText(_path);
                return JsonSerializer.Deserialize<GeneralSiteSettings>(json, JsonRead)
                       ?? new GeneralSiteSettings();
            }
            catch
            {
                return new GeneralSiteSettings();
            }
        }
    }

    public void Save(GeneralSiteSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);
        Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
        var json = JsonSerializer.Serialize(settings, JsonWrite);
        lock (_fileLock)
        {
            File.WriteAllText(_path, json);
        }
    }

    /// <summary>Deserialize payload từ back office (camelCase); dùng chung tùy chọn đọc file.</summary>
    public static GeneralSiteSettings? DeserializeFromJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        return JsonSerializer.Deserialize<GeneralSiteSettings>(json, JsonRead);
    }

    public string GetConfigPathForDiagnostics() => _path;

    /// <summary>
    /// Builds a fonts.googleapis.com/css2 URL for known webfont families referenced in the saved font-family stack.
    /// </summary>
    public string? GetGoogleFontsStylesheetUrl(string? fontFamilyCss)
    {
        if (string.IsNullOrWhiteSpace(fontFamilyCss)) return null;

        static void Add(List<string> list, string googleFamilyQuery)
        {
            if (!list.Contains(googleFamilyQuery, StringComparer.Ordinal))
                list.Add(googleFamilyQuery);
        }

        var specs = new List<string>();
        if (fontFamilyCss.Contains("Open Sans", StringComparison.OrdinalIgnoreCase))
            Add(specs, "Open+Sans:wght@400;600;700");
        if (fontFamilyCss.Contains("Inter", StringComparison.OrdinalIgnoreCase))
            Add(specs, "Inter:wght@400;500;600;700");
        if (fontFamilyCss.Contains("Roboto", StringComparison.OrdinalIgnoreCase))
            Add(specs, "Roboto:wght@400;500;700");
        if (fontFamilyCss.Contains("Lato", StringComparison.OrdinalIgnoreCase))
            Add(specs, "Lato:wght@400;700");
        if (fontFamilyCss.Contains("Merriweather", StringComparison.OrdinalIgnoreCase))
            Add(specs, "Merriweather:wght@400;700");
        if (fontFamilyCss.Contains("SourceHanSansCN", StringComparison.OrdinalIgnoreCase))
            Add(specs, "Source+Han+Sans+CN:wght@400;500;600;700");
        if (fontFamilyCss.Contains("Microsoft YaHei", StringComparison.OrdinalIgnoreCase))
            Add(specs, "Microsoft+YaHei:wght@400;500;600;700");

        if (specs.Count == 0) return null;

        return "https://fonts.googleapis.com/css2?"
               + string.Join("&", specs.Select(s => "family=" + s))
               + "&display=swap";
    }

    public static string SanitizeHex(string? value, string fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        var v = value.Trim();
        if (Regex.IsMatch(v, "^#[0-9A-Fa-f]{6}$", RegexOptions.CultureInvariant)) return v.ToLowerInvariant();
        if (Regex.IsMatch(v, "^#[0-9A-Fa-f]{3}$", RegexOptions.CultureInvariant))
        {
            return string.Concat("#", v[1], v[1], v[2], v[2], v[3], v[3]).ToLowerInvariant();
        }

        return fallback;
    }

    public static string SanitizeContentWrapperClass(string? value, string fallback = "box-padding")
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        var v = value.Trim();
        return v switch
        {
            "box-padding" => "box-padding",
            "container" => "container",
            _ => fallback,
        };
    }
}
