using Microsoft.Extensions.Options;
using TinifyAPI;
using umb_projectv13;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.IO;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.PropertyEditors;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Models.Entities;
using Umbraco.Extensions;

namespace umb_projectv13.Notifications;

/// <summary>
/// Compress images after Umbraco has saved the file to the media filesystem.
/// This is done in MediaSaved to ensure the file exists (in MediaSaving, sometimes the path can't be resolved).
/// </summary>
public sealed class TinifyMediaSavedHandler : INotificationAsyncHandler<MediaSavedNotification>
{
    private const string OversizedImageUserMessage =
        "Your image is too large. Please optimize it here (https://squoosh.app/) before uploading. The recommended maximum image size is 500 KB.";

    private static readonly HashSet<int> InFlightDbUpdates = new();

    private static readonly HashSet<string> TinifyExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".avif"
    };

    private readonly MediaFileManager _mediaFileManager;
    private readonly MediaUrlGeneratorCollection _mediaUrlGenerators;
    private readonly IOptionsMonitor<TinifyMediaOptions> _options;
    private readonly ILogger<TinifyMediaSavedHandler> _logger;
    private readonly IMediaService _mediaService;

    public TinifyMediaSavedHandler(
        MediaFileManager mediaFileManager,
        MediaUrlGeneratorCollection mediaUrlGenerators,
        IOptionsMonitor<TinifyMediaOptions> options,
        IMediaService mediaService,
        ILogger<TinifyMediaSavedHandler> logger)
    {
        _mediaFileManager = mediaFileManager;
        _mediaUrlGenerators = mediaUrlGenerators;
        _options = options;
        _mediaService = mediaService;
        _logger = logger;
    }

    public async Task HandleAsync(MediaSavedNotification notification, CancellationToken cancellationToken)
    {
        var opts = _options.CurrentValue;
        if (!opts.Enabled || string.IsNullOrWhiteSpace(opts.ApiKey))
        {
            _logger.LogWarning("Tinify is disabled or ApiKey is not configured (Tinify:Enabled/ Tinify:ApiKey).");
            notification.Messages.Add(new EventMessage(
                "Tinify",
                "Cannot compress images because Tinify is not configured (Tinify:Enabled/ Tinify:ApiKey).",
                EventMessageType.Warning));
            return;
        }

        Tinify.Key = opts.ApiKey.Trim();

        foreach (var media in notification.SavedEntities.OfType<IMedia>())
        {
            cancellationToken.ThrowIfCancellationRequested();

            // If this is the save caused by the handler updating umbracoBytes, skip (avoid loop & avoid calling Tinify again).
            lock (InFlightDbUpdates)
            {
                if (InFlightDbUpdates.Contains(media.Id))
                {
                    InFlightDbUpdates.Remove(media.Id);
                    continue;
                }
            }

            // Only process if the file has changed (upload/replace). If not, skip to avoid wasting Tinify quota.
            if (media is IRememberBeingDirty rbd && !rbd.WasPropertyDirty(Constants.Conventions.Media.File))
            {
                continue;
            }

            await TryOptimizeMediaAsync(notification.Messages, opts, media, cancellationToken).ConfigureAwait(false);
        }
    }

    private async Task TryOptimizeMediaAsync(
        EventMessages messages,
        TinifyMediaOptions options,
        IMedia media,
        CancellationToken cancellationToken)
    {
        // Get the file path from the umbracoFile property
        if (!media.TryGetMediaPath(Constants.Conventions.Media.File, _mediaUrlGenerators, out var mediaFilePath))
        {
            _logger.LogDebug("Tinify skip media {MediaId}: cannot resolve umbracoFile/media path.", media.Id);
            return;
        }

        var relativePath = _mediaFileManager.FileSystem.GetRelativePath(mediaFilePath!);
        var ext = Path.GetExtension(relativePath);
        if (string.IsNullOrEmpty(ext) || !TinifyExtensions.Contains(ext))
        {
            _logger.LogDebug("Tinify skip media {MediaId}: extension not supported ({Ext}). Path={Path}", media.Id, ext, relativePath);
            return;
        }

        // In MediaSaved, the media file can still be temporarily locked by another process.
        // If we throw here, Umbraco backoffice shows "An unknown error occurred" for the upload.
        // Retry a few times and if still locked, just skip compression for this save.
        byte[] sourceBytes;
        try
        {
            sourceBytes = await ReadAllBytesWithRetryAsync(relativePath, media.Id, cancellationToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning(ex, "Tinify skip media {MediaId}: cannot read file (locked/in use). Path={Path}", media.Id, relativePath);
            messages.Add(new EventMessage(
                "Tinify",
                $"Skipped compression for media #{media.Id} because the file is temporarily locked. Please try saving again.",
                EventMessageType.Info));
            return;
        }

        if (sourceBytes.Length == 0)
        {
            return;
        }

        byte[] optimized;
        try
        {
            optimized = await Tinify.FromBuffer(sourceBytes).ToBuffer().ConfigureAwait(false);
        }
        catch (AccountException ex)
        {
            _logger.LogError(ex, "Tinify rejected (account/API key/limit). Keep original file for media {MediaId}.", media.Id);
            messages.Add(new EventMessage(
                "Tinify",
                $"Cannot compress image (AccountException) for media #{media.Id}. Check API key/quota Tinify.",
                EventMessageType.Error));
            return;
        }
        catch (ClientException ex)
        {
            _logger.LogWarning(ex, "Tinify cannot process file (format/content). Keep original file for media {MediaId}.", media.Id);
            messages.Add(new EventMessage(
                "Tinify",
                $"Cannot compress image (ClientException) for media #{media.Id}. File may be invalid.",
                EventMessageType.Warning));
            return;
        }
        catch (ServerException ex)
        {
            _logger.LogWarning(ex, "Tinify server temporary error. Keep original file for media {MediaId}.", media.Id);
            messages.Add(new EventMessage(
                "Tinify",
                $"Tinify temporary error (ServerException) for media #{media.Id}.",
                EventMessageType.Warning));
            return;
        }
        catch (ConnectionException ex)
        {
            _logger.LogWarning(ex, "Cannot connect to Tinify. Keep original file for media {MediaId}.", media.Id);
            messages.Add(new EventMessage(
                "Tinify",
                $"Cannot connect to Tinify (ConnectionException) for media #{media.Id}.",
                EventMessageType.Warning));
            return;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error when calling Tinify. Keep original file for media {MediaId}.", media.Id);
            messages.Add(new EventMessage(
                "Tinify",
                $"Error when compressing image for media #{media.Id}. Check log for details.",
                EventMessageType.Warning));
            return;
        }

        if (optimized.Length == 0)
        {
            messages.Add(new EventMessage(
                "Tinify",
                $"Tinify returned empty output for media #{media.Id}.",
                EventMessageType.Warning));
            return;
        }

        var maxBytesAfterCompression = options.MaxFileSizeBytesAfterCompression;
        if (optimized.Length > maxBytesAfterCompression)
        {
            _logger.LogWarning(
                "Rejected media {MediaId}: compressed size {Compressed} bytes exceeds limit {Limit} bytes.",
                media.Id,
                optimized.Length,
                maxBytesAfterCompression);
            RejectOversizedUpload(messages, media, relativePath);
            return;
        }

        if (optimized.Length == 0 || optimized.Length >= sourceBytes.Length)
        {
            _logger.LogDebug("Tinify did not reduce size for media {MediaId}, skipping overwrite.", media.Id);
            messages.Add(new EventMessage(
                "Tinify",
                $"Called Tinify for media #{media.Id} but did not reduce size ({sourceBytes.Length} bytes).",
                EventMessageType.Info));
            return;
        }

        await using var outStream = new MemoryStream(optimized, writable: false);
        outStream.Position = 0;

        // Overwrite the saved file directly (don't Save IMedia again -> avoid notification loop)
        _mediaFileManager.FileSystem.AddFile(relativePath, outStream, overrideIfExists: true);

        // Update metadata size in DB (field umbracoBytes) to show correctly in Backoffice.
        // Note: this operation will trigger MediaSaved again -> use InFlightDbUpdates to skip.
        try
        {
            media.SetValue(Constants.Conventions.Media.Bytes, optimized.Length);
            lock (InFlightDbUpdates)
            {
                InFlightDbUpdates.Add(media.Id);
            }
            _mediaService.Save(media, Constants.Security.SuperUserId);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Cannot update umbracoBytes for media {MediaId}.", media.Id);
        }

        _logger.LogInformation(
            "Compressed media {MediaId} ({Path}) with Tinify: {Before} → {After} bytes.",
            media.Id,
            relativePath,
            sourceBytes.Length,
            optimized.Length);

        messages.Add(new EventMessage(
            "Tinify",
            $"Compressed media #{media.Id}: {sourceBytes.Length} → {optimized.Length} bytes.",
            EventMessageType.Success));
    }

    /// <summary>
    /// Removes the media item and underlying stored file after the compressed image still exceeds the configured limit.
    /// </summary>
    private void RejectOversizedUpload(EventMessages messages, IMedia media, string relativePath)
    {
        messages.Add(new EventMessage(
            "Media",
            OversizedImageUserMessage,
            EventMessageType.Error));

        try
        {
            _mediaService.Delete(media, Constants.Security.SuperUserId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete media {MediaId} after rejecting oversized upload.", media.Id);
        }

        try
        {
            if (_mediaFileManager.FileSystem.FileExists(relativePath))
            {
                _mediaFileManager.DeleteMediaFiles(new[] { relativePath });
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete rejected media file at path {Path}.", relativePath);
        }
    }

    private async Task<byte[]> ReadAllBytesWithRetryAsync(string relativePath, int mediaId, CancellationToken cancellationToken)
    {
        const int maxAttempts = 5;
        var delayMs = 80;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                await using var input = _mediaFileManager.FileSystem.OpenFile(relativePath);
                if (ReferenceEquals(input, Stream.Null) || !input.CanRead)
                    throw new IOException("Media file stream is not readable.");

                await using var buffer = new MemoryStream();
                await input.CopyToAsync(buffer, cancellationToken).ConfigureAwait(false);
                return buffer.ToArray();
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                if (attempt == maxAttempts)
                    throw;

                _logger.LogDebug(ex,
                    "Tinify read retry {Attempt}/{Max} for media {MediaId}. Path={Path}",
                    attempt, maxAttempts, mediaId, relativePath);

                await Task.Delay(delayMs, cancellationToken).ConfigureAwait(false);
                delayMs = Math.Min(delayMs * 2, 800);
            }
        }

        // unreachable
        return Array.Empty<byte>();
    }
}

