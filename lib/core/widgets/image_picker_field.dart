import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../services/image_upload_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_dimensions.dart';
import 'app_feedback.dart';
import 'app_surfaces.dart';
import 'image_picker_strings.dart';

/// Holds what an [ImagePickerField] currently shows: the saved (or typed) URL,
/// or a local image that is still waiting to be uploaded on save.
class ImagePickerController extends ChangeNotifier {
  ImagePickerController({String? url}) : _url = url?.trim() ?? '';

  String _url;
  PickedImage? _picked;
  bool _uploading = false;
  bool _disposed = false;

  /// The image URL currently in use; empty when there is none.
  String get url => _url;

  /// A local image picked on this device that has not been uploaded yet.
  PickedImage? get picked => _picked;

  bool get hasImage => _picked != null || _url.isNotEmpty;
  bool get isUploading => _uploading;

  void setUrl(String value) {
    _url = value.trim();
    _picked = null;
    _notify();
  }

  void setPicked(PickedImage image) {
    _picked = image;
    _notify();
  }

  void clear() => setUrl('');

  /// Discards any pending local image and shows [url] again.
  void reset(String? url) => setUrl(url ?? '');

  /// The value to store in Firestore. A pending local image is uploaded to
  /// [folder] first (and then counts as the saved URL, so a retry after a
  /// failed save does not upload it twice). Throws [ImageUploadException].
  Future<String> resolveUrl(
    ImageUploadService service, {
    required String folder,
  }) async {
    final image = _picked;
    if (image == null) {
      return _url;
    }
    _uploading = true;
    _notify();
    try {
      final uploaded = await service.upload(image, folder: folder);
      _url = uploaded;
      _picked = null;
      return uploaded;
    } finally {
      _uploading = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

enum ImagePickerShape { rounded, circle }

/// One "Add Image" control for every image input: it shows a single button,
/// and the source (device, camera, URL) is chosen in a bottom sheet.
class ImagePickerField extends StatelessWidget {
  const ImagePickerField({
    super.key,
    required this.controller,
    this.enabled = true,
    this.shape = ImagePickerShape.rounded,
    this.fallbackIcon = Icons.image_outlined,
    this.label,
  });

  final ImagePickerController controller;
  final bool enabled;
  final ImagePickerShape shape;
  final IconData fallbackIcon;

  /// Defaults to the localized "Image".
  final String? label;

  static final _picker = ImagePicker();

  bool get _isCircle => shape == ImagePickerShape.circle;

  Future<void> _open(BuildContext context) async {
    final choice = await showModalBottomSheet<_SourceChoice>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ImageSourceSheet(
        title: controller.hasImage
            ? ImagePickerStrings.of(context).changeImage
            : ImagePickerStrings.of(context).addImage,
        initialUrl: controller.picked == null ? controller.url : '',
      ),
    );
    if (choice == null || !context.mounted) {
      return;
    }
    if (choice.url != null) {
      controller.setUrl(choice.url!);
    } else if (choice.source != null) {
      await _pickLocal(context, choice.source!);
    }
  }

  Future<void> _pickLocal(BuildContext context, ImageSource source) async {
    final strings = ImagePickerStrings.of(context);
    final messenger = ScaffoldMessenger.of(context);
    void say(String message) => showAppSnackBar(
          context,
          message,
          tone: AppTone.error,
          messenger: messenger,
        );

    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (file == null) {
        return; // Picker was dismissed.
      }
      final contentType = ImageRules.contentTypeForName(file.name) ??
          ImageRules.contentTypeForMime(file.mimeType);
      if (contentType == null) {
        say(strings.unsupportedFile);
        return;
      }
      final bytes = await file.readAsBytes();
      if (bytes.length > ImageRules.maxBytes) {
        say(strings.fileTooLarge);
        return;
      }
      controller.setPicked(PickedImage(bytes: bytes, contentType: contentType));
    } on PlatformException catch (error) {
      final camera = source == ImageSource.camera;
      if (error.code.contains('access_denied')) {
        say(camera ? strings.cameraDenied : strings.galleryDenied);
      } else if (camera && error.code == 'no_available_camera') {
        say(strings.cameraUnavailable);
      } else {
        say(strings.pickFailed);
      }
    } catch (_) {
      // e.g. a platform without camera support.
      say(
        source == ImageSource.camera
            ? strings.cameraUnavailable
            : strings.pickFailed,
      );
    }
  }

  Widget _preview(BuildContext context, ImagePickerStrings strings) {
    final picked = controller.picked;
    final fallback = Center(
      child: Icon(fallbackIcon, color: AppColors.primary, size: 40),
    );
    final Widget image = picked != null
        ? Image.memory(picked.bytes, fit: BoxFit.cover)
        : AppNetworkImage(url: controller.url, fallback: fallback);

    return _frame(
      child: Stack(
        fit: StackFit.expand,
        children: [
          image,
          if (controller.isUploading)
            ColoredBox(
              color: Colors.black54,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      strings.uploading,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _empty(BuildContext context, ImagePickerStrings strings) {
    const primary = AppColors.primary;
    return _frame(
      borderColor: AppColors.primary,
      background: AppColors.brandPrimarySubtle,
      child: InkWell(
        onTap: enabled ? () => _open(context) : null,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.add, color: primary),
                const SizedBox(height: 4),
                Text(
                  strings.addImage,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.textBrand,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _frame({
    required Widget child,
    Color? borderColor,
    Color? background,
  }) {
    final decoration = BoxDecoration(
      color: background ?? AppColors.bgSubtle,
      shape: _isCircle ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: _isCircle ? null : AppRadius.mdAll,
      border: Border.all(
        color: borderColor ?? AppColors.borderDefault,
        width: borderColor == null ? AppBorder.thin : AppBorder.thick,
      ),
    );
    final framed = Container(
      clipBehavior: Clip.antiAlias,
      decoration: decoration,
      child: Material(type: MaterialType.transparency, child: child),
    );
    return _isCircle
        ? SizedBox.square(dimension: 120, child: framed)
        : SizedBox(height: 160, width: double.infinity, child: framed);
  }

  @override
  Widget build(BuildContext context) {
    final strings = ImagePickerStrings.of(context);
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label ?? strings.image,
          textAlign: _isCircle ? TextAlign.center : null,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        ListenableBuilder(
          listenable: controller,
          builder: (context, _) {
            if (!controller.hasImage) {
              return Align(
                child: _empty(context, strings),
              );
            }
            final busy = !enabled || controller.isUploading;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(child: _preview(context, strings)),
                const SizedBox(height: 4),
                Wrap(
                  alignment: WrapAlignment.center,
                  children: [
                    TextButton.icon(
                      onPressed: busy ? null : () => _open(context),
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      label: Text(strings.changeImage),
                    ),
                    TextButton(
                      onPressed: busy ? null : controller.clear,
                      style: TextButton.styleFrom(
                        foregroundColor: theme.colorScheme.error,
                      ),
                      child: Text(strings.removeImage),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _SourceChoice {
  const _SourceChoice.source(ImageSource this.source) : url = null;
  const _SourceChoice.url(String this.url) : source = null;

  final ImageSource? source;
  final String? url;
}

class _ImageSourceSheet extends StatefulWidget {
  const _ImageSourceSheet({required this.title, required this.initialUrl});

  final String title;
  final String initialUrl;

  @override
  State<_ImageSourceSheet> createState() => _ImageSourceSheetState();
}

class _ImageSourceSheetState extends State<_ImageSourceSheet> {
  late final TextEditingController _urlController;
  bool _urlMode = false;
  String? _urlError;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: widget.initialUrl);
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  void _submitUrl(ImagePickerStrings strings) {
    final text = _urlController.text.trim();
    if (text.isEmpty) {
      setState(() => _urlError = strings.emptyUrl);
    } else if (!ImageRules.isValidImageUrl(text)) {
      setState(() => _urlError = strings.invalidUrl);
    } else {
      Navigator.of(context).pop(_SourceChoice.url(text));
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = ImagePickerStrings.of(context);
    final titleStyle = Theme.of(context).textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
        );

    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsetsDirectional.fromSTEB(
          20,
          0,
          20,
          MediaQuery.viewInsetsOf(context).bottom + 12,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: _urlMode
              ? [
                  Text(strings.useImageUrl, style: titleStyle),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _urlController,
                    autofocus: true,
                    keyboardType: TextInputType.url,
                    textInputAction: TextInputAction.done,
                    textDirection: TextDirection.ltr,
                    onChanged: (_) {
                      if (_urlError != null) {
                        setState(() => _urlError = null);
                      }
                    },
                    onSubmitted: (_) => _submitUrl(strings),
                    decoration: InputDecoration(
                      labelText: strings.imageUrl,
                      hintText: 'https://…',
                      prefixIcon: const Icon(Icons.link),
                      errorText: _urlError,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: Text(strings.cancel),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: () => _submitUrl(strings),
                        child: Text(strings.done),
                      ),
                    ],
                  ),
                ]
              : [
                  Text(widget.title, style: titleStyle),
                  const SizedBox(height: 4),
                  const Divider(),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.photo_library_outlined),
                    title: Text(strings.chooseFromDevice),
                    onTap: () => Navigator.of(context)
                        .pop(const _SourceChoice.source(ImageSource.gallery)),
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.photo_camera_outlined),
                    title: Text(strings.takePhoto),
                    onTap: () => Navigator.of(context)
                        .pop(const _SourceChoice.source(ImageSource.camera)),
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.link),
                    title: Text(strings.useImageUrl),
                    onTap: () => setState(() => _urlMode = true),
                  ),
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: Text(strings.cancel),
                    ),
                  ),
                ],
        ),
      ),
    );
  }
}
