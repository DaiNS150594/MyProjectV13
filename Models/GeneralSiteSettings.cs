using System.Text.Json.Serialization;
using Newtonsoft.Json;

/// <summary>
/// Umbraco backoffice JSON thường dùng Newtonsoft — cần cả JsonProperty (Newtonsoft) và JsonPropertyName (file + STJ).
/// </summary>
public class GeneralSiteSettings
{
    [JsonProperty("tagline")]
    [JsonPropertyName("tagline")]
    public string? Tagline { get; set; }

    /// <summary>
    /// Cache-buster for favicon.ico. Updated by backoffice upload action.
    /// </summary>
    [JsonProperty("faviconVersion")]
    [JsonPropertyName("faviconVersion")]
    public string? FaviconVersion { get; set; }

    [JsonProperty("fontFamily")]
    [JsonPropertyName("fontFamily")]
    public string FontFamily { get; set; } =
        "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif";

    [JsonProperty("primaryColor")]
    [JsonPropertyName("primaryColor")]
    public string PrimaryColor { get; set; } = "#1a1a2e";

    [JsonProperty("secondaryColor")]
    [JsonPropertyName("secondaryColor")]
    public string SecondaryColor { get; set; } = "#16213e";

    [JsonProperty("accentColor")]
    [JsonPropertyName("accentColor")]
    public string AccentColor { get; set; } = "#e94560";

    [JsonProperty("customCss")]
    [JsonPropertyName("customCss")]
    public string? CustomCss { get; set; }

    /// <summary>
    /// CSS người dùng nhập thủ công (tách khỏi <see cref="CustomCss"/> để không lẫn với CSS generate như @font-face).
    /// </summary>
    [JsonProperty("userCss")]
    [JsonPropertyName("userCss")]
    public string? UserCss { get; set; }

    /// <summary>JavaScript người dùng (jQuery có sẵn trong bundle trước file này).</summary>
    [JsonProperty("userJs")]
    [JsonPropertyName("userJs")]
    public string? UserJs { get; set; }

    [JsonProperty("contentWrapperClass")]
    [JsonPropertyName("contentWrapperClass")]
    public string ContentWrapperClass { get; set; } = "box-padding";

    [JsonProperty("boxPadding")]
    [JsonPropertyName("boxPadding")]
    public BoxPaddingSettings BoxPadding { get; set; } = new();

    /// <summary>Raw SCSS for the <c>.container</c> block (written to _common.scss when wrapper is <c>container</c>).</summary>
    [JsonProperty("containerScss")]
    [JsonPropertyName("containerScss")]
    public string? ContainerScss { get; set; }

    [JsonProperty("useRem10px")]
    [JsonPropertyName("useRem10px")]
    public bool UseRem10px { get; set; }
}

public class BoxPaddingSettings
{
    [JsonProperty("minPaddingInlinePx")]
    [JsonPropertyName("minPaddingInlinePx")]
    public int MinPaddingInlinePx { get; set; } = 15;

    [JsonProperty("maxPaddingInlinePx")]
    [JsonPropertyName("maxPaddingInlinePx")]
    public int MaxPaddingInlinePx { get; set; } = 300;

    [JsonProperty("minFluidViewportPx")]
    [JsonPropertyName("minFluidViewportPx")]
    public int MinFluidViewportPx { get; set; } = 870;

    [JsonProperty("maxFluidViewportPx")]
    [JsonPropertyName("maxFluidViewportPx")]
    public int MaxFluidViewportPx { get; set; } = 1820;
}
