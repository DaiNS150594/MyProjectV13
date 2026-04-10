using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Web.BackOffice.Controllers;
using Umbraco.Cms.Web.BackOffice.Filters;

// UmbracoAuthorizedJsonController only serves JSON; multipart upload doesn't match action → 404.
[ValidateAngularAntiForgeryToken]
public class GeneralSettingsApiController : UmbracoAuthorizedApiController
{
    private static readonly string[] AllowedFontExtensions = [".woff2", ".woff", ".ttf", ".otf"];
    private const long MaxFontUploadBytes = 5 * 1024 * 1024;
    private const long MaxBatchFontUploadBytes = 50 * 1024 * 1024;
    private const int MaxFontFilesPerRequest = 50;

    private const long MaxFaviconUploadBytes = 512 * 1024; // 512 KB

    private readonly GeneralSiteSettingsService _settings;
    private readonly IWebHostEnvironment _env;

    public GeneralSettingsApiController(GeneralSiteSettingsService settings, IWebHostEnvironment env)
    {
        _settings = settings;
        _env = env;
    }

    [HttpGet]
    public IActionResult Get() => Ok(_settings.Get());

    /// <summary>

    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Save(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false);
        var json = await reader.ReadToEndAsync(cancellationToken).ConfigureAwait(false);
        var model = GeneralSiteSettingsService.DeserializeFromJson(json);
        if (model == null)
            return BadRequest(new { ok = false, error = "Invalid or empty JSON body." });

        _settings.Save(model);

        var boxScss = TryUpdateCommonScssBoxPadding(model, out var scssPath, out var boxScssError);
        var containerScss = TryUpdateCommonScssContainer(model, out var containerPath, out var containerScssError);
        var remScss = TryUpdateCommonScssRem10(model, out var commonPath2, out var remScssError);
        var userJsWritten = TryWriteUserJsFile(model, out var userJsPath, out var userJsError);
        var scssPathOut =
            !string.IsNullOrEmpty(scssPath) ? scssPath :
            !string.IsNullOrEmpty(containerPath) ? containerPath :
            commonPath2;
        var scssUpdated = boxScss || containerScss || remScss;
        string? scssError = null;
        if (!string.IsNullOrEmpty(boxScssError)) scssError = boxScssError;
        if (!string.IsNullOrEmpty(containerScssError))
            scssError = string.IsNullOrEmpty(scssError) ? containerScssError : scssError + " " + containerScssError;
        if (!string.IsNullOrEmpty(remScssError))
            scssError = string.IsNullOrEmpty(scssError) ? remScssError : scssError + " " + remScssError;

        return Ok(new
        {
            ok = true,
            path = _settings.GetConfigPathForDiagnostics(),
            scssUpdated,
            scssPath = scssPathOut,
            scssError,
            userJsWritten,
            userJsPath,
            userJsError,
        });
    }

    private static readonly string BoxPaddingMarkStart = "/* __tg_box_padding_start__ */";
    private static readonly string BoxPaddingMarkEnd = "/* __tg_box_padding_end__ */";
    private static readonly string ContainerMarkStart = "/* __tg_container_start__ */";
    private static readonly string ContainerMarkEnd = "/* __tg_container_end__ */";
    private static readonly string Rem10MarkStart = "/* __tg_rem10_start__ */";
    private static readonly string Rem10MarkEnd = "/* __tg_rem10_end__ */";
    private const int MaxContainerScssChars = 200_000;
    private const int MaxRem10ScssChars = 50_000;
    private const int MaxUserJsChars = 200_000;

    private bool TryWriteUserJsFile(GeneralSiteSettings model, out string filePath, out string? error)
    {
        filePath = "";
        error = null;

        try
        {
            var root = ResolveWebRootPath();
            var dir = Path.Combine(root, "scripts", "custom");
            Directory.CreateDirectory(dir);
            filePath = Path.Combine(dir, "site-user.js");
            var body = model.UserJs == null ? "" : model.UserJs.TrimEnd();
            if (body.Length > MaxUserJsChars)
            {
                error = $"Custom JS exceeds maximum length ({MaxUserJsChars} characters).";
                return false;
            }

            var content = string.IsNullOrEmpty(body)
                ? "// Custom site JavaScript — edit in Backoffice > General settings.\n"
                : body + (body.EndsWith('\n') ? "" : Environment.NewLine);
            System.IO.File.WriteAllText(filePath, content);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private bool TryUpdateCommonScssBoxPadding(GeneralSiteSettings model, out string scssPath, out string? error)
    {
        scssPath = "";
        error = null;

        try
        {
            if (!string.Equals(model.ContentWrapperClass, "box-padding", StringComparison.OrdinalIgnoreCase))
                return false;

            scssPath = ResolveCommonScssPath();
            if (string.IsNullOrWhiteSpace(scssPath) || !System.IO.File.Exists(scssPath))
            {
                error = "Could not locate wwwroot/css/common/_common.scss.";
                return false;
            }

            var bp = model.BoxPadding ?? new BoxPaddingSettings();
            var generated = BuildBoxPaddingScss(bp);

            var text = System.IO.File.ReadAllText(scssPath);
            var start = text.IndexOf(BoxPaddingMarkStart, StringComparison.Ordinal);
            var end = text.IndexOf(BoxPaddingMarkEnd, StringComparison.Ordinal);
            if (start < 0 || end < 0 || end < start)
            {
                error = $"Markers not found in _common.scss: {BoxPaddingMarkStart} / {BoxPaddingMarkEnd}.";
                return false;
            }

            var afterEnd = end + BoxPaddingMarkEnd.Length;
            var updated = text[..start] + generated + text[afterEnd..];
            System.IO.File.WriteAllText(scssPath, updated);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private string ResolveCommonScssPath()
    {
        // Debug often runs from bin\Debug\netX; try to find repo root (has .csproj) and then wwwroot/css/common/_common.scss.
        var startDir = AppContext.BaseDirectory;
        try
        {
            var dir = new DirectoryInfo(Path.GetFullPath(startDir));
            for (var i = 0; i < 10 && dir != null; i++, dir = dir.Parent)
            {
                if (!dir.Exists) break;
                var csprojs = dir.GetFiles("*.csproj", SearchOption.TopDirectoryOnly);
                if (csprojs.Length == 0) continue;
                var candidate = Path.Combine(dir.FullName, "wwwroot", "css", "common", "_common.scss");
                if (System.IO.File.Exists(candidate))
                    return candidate;
            }
        }
        catch
        {
            /* ignore */
        }

        return Path.Combine(_env.ContentRootPath, "wwwroot", "css", "common", "_common.scss");
    }

    private string ResolveWebRootPath()
    {
        // Mirror ResolveCommonScssPath logic: when running from bin\Debug\netX,
        // IWebHostEnvironment.WebRootPath may point into the build output.
        // We want uploads to land in the project wwwroot so they persist and are served consistently.
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

        if (!string.IsNullOrEmpty(_env.WebRootPath))
            return _env.WebRootPath;

        return Path.Combine(_env.ContentRootPath, "wwwroot");
    }


    private static BoxPaddingSettings NormalizeBoxPadding(BoxPaddingSettings s)
    {
        var minPad = Math.Clamp(s.MinPaddingInlinePx, 0, 2000);
        var maxPad = Math.Clamp(s.MaxPaddingInlinePx, 0, 2000);
        if (maxPad < minPad) (minPad, maxPad) = (maxPad, minPad);

        var minVw = Math.Clamp(s.MinFluidViewportPx, 0, 10000);
        var maxVw = Math.Clamp(s.MaxFluidViewportPx, 0, 10000);
        if (maxVw < minVw) (minVw, maxVw) = (maxVw, minVw);
        if (maxVw == minVw) maxVw = minVw + 1;

        return new BoxPaddingSettings
        {
            MinPaddingInlinePx = minPad,
            MaxPaddingInlinePx = maxPad,
            MinFluidViewportPx = minVw,
            MaxFluidViewportPx = maxVw,
        };
    }

    private static string BuildBoxPaddingScss(BoxPaddingSettings raw)
    {
        var s = NormalizeBoxPadding(raw);
        var deltaPad = s.MaxPaddingInlinePx - s.MinPaddingInlinePx;
        var deltaVw = s.MaxFluidViewportPx - s.MinFluidViewportPx;

        var sb = new StringBuilder();
        sb.AppendLine(BoxPaddingMarkStart);
        sb.AppendLine(".box-padding {");
        sb.AppendLine("  // Generated from Setting General");
        sb.AppendLine($"  // - Below {s.MinFluidViewportPx}px: padding-inline is always {s.MinPaddingInlinePx}px.");
        sb.AppendLine($"  // - From {s.MinFluidViewportPx}px to {s.MaxFluidViewportPx}px: padding-inline scales from {s.MinPaddingInlinePx}px to {s.MaxPaddingInlinePx}px.");
        sb.AppendLine($"  padding-inline: {s.MinPaddingInlinePx}px;");
        sb.AppendLine();
        sb.AppendLine($"  @media (min-width: {s.MinFluidViewportPx}px) and (max-width: {s.MaxFluidViewportPx}px) {{");
        sb.AppendLine($"    padding-inline: calc({s.MinPaddingInlinePx}px + ({deltaPad} * (100vw - {s.MinFluidViewportPx}px) / {deltaVw}));");
        sb.AppendLine("  }");
        sb.AppendLine();
        sb.AppendLine($"  @media (min-width: {s.MaxFluidViewportPx}px) {{");
        sb.AppendLine($"    padding-inline: {s.MaxPaddingInlinePx}px;");
        sb.AppendLine("  }");
        sb.AppendLine("}");
        sb.AppendLine(BoxPaddingMarkEnd);
        return sb.ToString();
    }

    private bool TryUpdateCommonScssRem10(GeneralSiteSettings model, out string scssPath, out string? error)
    {
        scssPath = "";
        error = null;

        try
        {
            scssPath = ResolveCommonScssPath();
            if (string.IsNullOrWhiteSpace(scssPath) || !System.IO.File.Exists(scssPath))
            {
                error = "Could not locate wwwroot/css/common/_common.scss.";
                return false;
            }

            var text = System.IO.File.ReadAllText(scssPath);
            var start = text.IndexOf(Rem10MarkStart, StringComparison.Ordinal);
            var end = text.IndexOf(Rem10MarkEnd, StringComparison.Ordinal);
            if (start < 0 || end < 0 || end < start)
            {
                error = $"Markers not found in _common.scss: {Rem10MarkStart} / {Rem10MarkEnd}.";
                return false;
            }

            var body = model.UseRem10px ? Rem10ScssBlock() : "";
            if (body.Length > MaxRem10ScssChars)
            {
                error = $"Generated rem SCSS exceeds maximum length ({MaxRem10ScssChars} characters).";
                return false;
            }

            var afterEnd = end + Rem10MarkEnd.Length;
            var replacement = Rem10MarkStart
                              + (string.IsNullOrEmpty(body) ? "" : Environment.NewLine + body.TrimEnd())
                              + Environment.NewLine
                              + Rem10MarkEnd;
            var updated = text[..start] + replacement + text[afterEnd..];
            System.IO.File.WriteAllText(scssPath, updated);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private static string Rem10ScssBlock() =>
        string.Join(Environment.NewLine, new[]
        {
            "html {",
            "  font-size: 54%;",
            "",
            "  @media (min-width: 31.25rem) and (max-width: 61.938rem) {",
            "    //991px",
            "    font-size: 54%;",
            "  }",
            "",
            "  @media (min-width: 62rem) and (max-width: 64rem) {",
            "    //1024px",
            "    font-size: 55%;",
            "  }",
            "",
            "  @media (min-width: 65rem) and (max-width: 80rem) {",
            "    //1280px",
            "    font-size: 58%;",
            "  }",
            "",
            "  @media (min-width: 81rem) and (max-width: 90rem) {",
            "    //1366px",
            "    font-size: 60%;",
            "  }",
            "",
            "  @media (min-width: 91rem) {",
            "    //1600px up",
            "    font-size: 62.5%;",
            "  }",
            "}",
        });

    private bool TryUpdateCommonScssContainer(GeneralSiteSettings model, out string scssPath, out string? error)
    {
        scssPath = "";
        error = null;

        try
        {
            if (!string.Equals(model.ContentWrapperClass, "container", StringComparison.OrdinalIgnoreCase))
                return false;

            scssPath = ResolveCommonScssPath();
            if (string.IsNullOrWhiteSpace(scssPath) || !System.IO.File.Exists(scssPath))
            {
                error = "Could not locate wwwroot/css/common/_common.scss.";
                return false;
            }

            var body = string.IsNullOrWhiteSpace(model.ContainerScss)
                ? DefaultContainerScssBlock()
                : model.ContainerScss.Trim();
            if (body.Length > MaxContainerScssChars)
            {
                error = $"Container SCSS exceeds maximum length ({MaxContainerScssChars} characters).";
                return false;
            }

            var text = System.IO.File.ReadAllText(scssPath);
            var start = text.IndexOf(ContainerMarkStart, StringComparison.Ordinal);
            var end = text.IndexOf(ContainerMarkEnd, StringComparison.Ordinal);
            if (start < 0 || end < 0 || end < start)
            {
                error = $"Markers not found in _common.scss: {ContainerMarkStart} / {ContainerMarkEnd}.";
                return false;
            }

            var afterEnd = end + ContainerMarkEnd.Length;
            var replacement = ContainerMarkStart + Environment.NewLine + body.TrimEnd() + Environment.NewLine + ContainerMarkEnd;
            var updated = text[..start] + replacement + text[afterEnd..];
            System.IO.File.WriteAllText(scssPath, updated);
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    /// <summary>Default <c>.container</c> block (matches <c>_common.scss</c> / Setting General UI).</summary>
    private static string DefaultContainerScssBlock() =>
        string.Join(Environment.NewLine, new[]
        {
            ".container {",
            "  position: relative;",
            "  width: 100%;",
            "  padding: 0 15px;",
            "  margin: 0 auto;",
            "  z-index: 1;",
            "",
            "  @media (min-width: 48px) {",
            "    //768px",
            "    max-width: 100rem;",
            "  }",
            "",
            "  @media (min-width: 62rem) {",
            "    //992px",
            "    max-width: 110rem;",
            "  }",
            "",
            "  @media (min-width: 75rem) {",
            "    //1200px",
            "    max-width: 130rem;",
            "  }",
            "",
            "  @media (min-width: 87.5rem) {",
            "    //1400px",
            "    max-width: 129rem;",
            "  }",
            "  @media (min-width: 93.75rem) {",
            "    //1500px",
            "    max-width: 140rem;",
            "  }",
            "  @media (min-width: 100rem) {",
            "    //1600px",
            "    max-width: 150rem;",
            "  }",
            "  @media (min-width: 106.25rem) {",
            "    //1700px",
            "    max-width: 166.8rem;",
            "  }",
            "}",
        });

    /// <summary>Save font file to wwwroot/fonts (serve @font-face on frontend).</summary>
    [HttpPost]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxFontUploadBytes)]
    [RequestSizeLimit(MaxFontUploadBytes)]
    public async Task<IActionResult> UploadFont(CancellationToken cancellationToken)
    {
        if (!Request.HasFormContentType)
            return BadRequest(new { ok = false, error = "Request must be multipart/form-data." });

        var file = Request.Form.Files.GetFile("file");
        if (file is not { Length: > 0 })
            return BadRequest(new { ok = false, error = "No file." });

        if (file.Length > MaxFontUploadBytes)
            return BadRequest(new { ok = false, error = "File is too large (maximum 5 MB)." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (Array.IndexOf(AllowedFontExtensions, ext) < 0)
            return BadRequest(new { ok = false, error = "Only .woff2, .woff, .ttf, .otf are supported." });

        var webRoot = ResolveWebRootPath();

        var fontsDir = Path.Combine(webRoot, "fonts");
        Directory.CreateDirectory(fontsDir);

        var safeBase = SanitizeFileStem(Path.GetFileNameWithoutExtension(file.FileName));
        if (string.IsNullOrEmpty(safeBase))
            safeBase = "font";

        var unique = Guid.NewGuid().ToString("N")[..8];
        var physicalName = $"{unique}-{safeBase}{ext}";
        var physicalPath = Path.Combine(fontsDir, physicalName);

        await using (var stream = System.IO.File.Create(physicalPath))
        {
            await file.CopyToAsync(stream, cancellationToken).ConfigureAwait(false);
        }

        var relativeUrl = "/fonts/" + physicalName.Replace('\\', '/');
        var suggestedFontFamily = SanitizeFontFamilyDisplayName(safeBase);
        var format = FontFormatForExtension(ext);

        return Ok(new
        {
            ok = true,
            relativeUrl,
            suggestedFontFamily,
            format,
        });
    }

    /// <summary>Multiple font files into wwwroot/fonts/{family}/ — client creates @font-face (weight/style from file name).</summary>
    [HttpPost]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxBatchFontUploadBytes)]
    [RequestSizeLimit(MaxBatchFontUploadBytes)]
    public async Task<IActionResult> UploadFonts(CancellationToken cancellationToken)
    {
        if (!Request.HasFormContentType)
            return BadRequest(new { ok = false, error = "Request must be multipart/form-data." });

        var familyName = Request.Form["familyName"].FirstOrDefault();
        var files = new List<IFormFile>();
        foreach (var part in Request.Form.Files)
        {
            if (string.Equals(part.Name, "files", StringComparison.OrdinalIgnoreCase))
                files.Add(part);
        }

        if (files.Count == 0)
        {
            foreach (var part in Request.Form.Files)
                files.Add(part);
        }

        if (files.Count == 0)
            return BadRequest(new { ok = false, error = "No files." });

        if (files.Count > MaxFontFilesPerRequest)
            return BadRequest(new { ok = false, error = $"Maximum {MaxFontFilesPerRequest} files per request." });

        var webRoot = ResolveWebRootPath();

        var nonEmpty = files.Where(f => f is { Length: > 0 }).ToList();
        if (nonEmpty.Count == 0)
            return BadRequest(new { ok = false, error = "All files are empty." });

        long total = 0;
        foreach (var f in nonEmpty)
        {
            total += f.Length;
            if (f.Length > MaxFontUploadBytes)
                return BadRequest(new { ok = false, error = $"Each file must be less than {MaxFontUploadBytes / 1024 / 1024} MB: {f.FileName}" });
        }

        if (total > MaxBatchFontUploadBytes)
            return BadRequest(new { ok = false, error = $"Total size exceeds limit: {total / 1024 / 1024} MB" });

        var firstStem = SanitizeFileStem(Path.GetFileNameWithoutExtension(nonEmpty[0].FileName));
        var folderName = SanitizeFontFamilyFolderName(string.IsNullOrWhiteSpace(familyName) ? GuessFamilyFromStem(firstStem) : familyName);
        if (string.IsNullOrEmpty(folderName))
            folderName = "font";

        var familyDir = Path.Combine(webRoot, "fonts", folderName);
        Directory.CreateDirectory(familyDir);

        var outFiles = new List<object>();
        foreach (var file in nonEmpty)
        {
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (Array.IndexOf(AllowedFontExtensions, ext) < 0)
                return BadRequest(new { ok = false, error = $"Unsupported file format: {file.FileName}" });

            var stem = SanitizeFileStem(Path.GetFileNameWithoutExtension(file.FileName));
            if (string.IsNullOrEmpty(stem))
                stem = "font";

            var physicalName = $"{stem}{ext}";
            var physicalPath = Path.Combine(familyDir, physicalName);
            await using (var stream = System.IO.File.Create(physicalPath))
            {
                await file.CopyToAsync(stream, cancellationToken).ConfigureAwait(false);
            }

            var relativeUrl = "/fonts/" + folderName.Replace('\\', '/') + "/" + physicalName.Replace('\\', '/');
            outFiles.Add(new
            {
                fileName = physicalName,
                stem,
                relativeUrl,
                format = FontFormatForExtension(ext),
            });
        }

        return Ok(new
        {
            ok = true,
            familyName = folderName,
            files = outFiles,
        });
    }

    /// <summary>Upload favicon.ico to wwwroot/favicon.ico (overwrites).</summary>
    [HttpPost]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxFaviconUploadBytes)]
    [RequestSizeLimit(MaxFaviconUploadBytes)]
    public async Task<IActionResult> UploadFavicon(CancellationToken cancellationToken)
    {
        if (!Request.HasFormContentType)
            return BadRequest(new { ok = false, error = "Request must be multipart/form-data." });

        var file = Request.Form.Files.GetFile("file");
        if (file is not { Length: > 0 })
            return BadRequest(new { ok = false, error = "No file." });

        if (file.Length > MaxFaviconUploadBytes)
            return BadRequest(new { ok = false, error = $"File is too large (maximum {MaxFaviconUploadBytes / 1024} KB)." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!string.Equals(ext, ".ico", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { ok = false, error = "Only .ico is supported." });

        var webRoot = ResolveWebRootPath();

        Directory.CreateDirectory(webRoot);
        var physicalPath = Path.Combine(webRoot, "favicon.ico");

        await using (var stream = System.IO.File.Create(physicalPath))
        {
            await file.CopyToAsync(stream, cancellationToken).ConfigureAwait(false);
        }

        // update cache buster in settings file
        var settings = _settings.Get();
        settings.FaviconVersion = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        _settings.Save(settings);

        return Ok(new
        {
            ok = true,
            relativeUrl = "/favicon.ico",
            faviconVersion = settings.FaviconVersion,
        });
    }

    private static string GuessFamilyFromStem(string stem)
    {
        if (string.IsNullOrWhiteSpace(stem)) return "CustomFont";
        var idx = stem.IndexOf('-');
        if (idx > 0) return stem[..idx].Trim();
        idx = stem.IndexOf('_');
        if (idx > 0) return stem[..idx].Trim();
        return stem.Trim();
    }

    private static string SanitizeFontFamilyFolderName(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        var s = name.Trim();
        s = Regex.Replace(s, @"[^a-zA-Z0-9\-_]", "");
        return s.Length > 64 ? s[..64] : s;
    }

    private static string SanitizeFileStem(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "";
        var s = name.Trim();
        s = Regex.Replace(s, @"[^a-zA-Z0-9._\-\s]", "");
        s = Regex.Replace(s, @"\s+", "-");
        return s.Trim('-', '_', '.');
    }

    private static string SanitizeFontFamilyDisplayName(string stem)
    {
        if (string.IsNullOrWhiteSpace(stem)) return "CustomFont";
        var s = stem.Replace('-', ' ').Replace('_', ' ').Trim();
        s = Regex.Replace(s, @"[^a-zA-Z0-9\s\-]", "");
        s = Regex.Replace(s, @"\s+", " ").Trim();
        return string.IsNullOrEmpty(s) ? "CustomFont" : s;
    }

    private static string FontFormatForExtension(string ext) =>
        ext switch
        {
            ".woff2" => "woff2",
            ".woff" => "woff",
            ".ttf" => "truetype",
            ".otf" => "opentype",
            _ => "woff2",
        };
}
