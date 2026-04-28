namespace umb_projectv13;

public sealed class TinifyMediaOptions
{
    public const string SectionName = "Tinify";

    /// <summary>
    /// Tinify API key from https://tinify.com/developers — prefer User Secrets or environment variables; avoid committing secrets.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Maximum allowed size in bytes after Tinify compression (default 500 KB). Larger results reject the upload.
    /// </summary>
    public int MaxFileSizeBytesAfterCompression { get; set; } = 512000;
}
