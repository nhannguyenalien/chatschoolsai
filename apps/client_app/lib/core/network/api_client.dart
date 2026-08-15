import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../config/app_config.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient(this._dio, this._readApiKey);

  final Dio _dio;
  final String? Function() _readApiKey;

  Future<Map<String, dynamic>> getJson(String path) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        path,
        options: Options(headers: _headers()),
      );
      return response.data ?? const {};
    } on DioException catch (error) {
      throw _mapError(error);
    }
  }

  Future<Map<String, dynamic>> postJson(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        path,
        data: body,
        options: Options(headers: _headers()),
      );
      return response.data ?? const {};
    } on DioException catch (error) {
      throw _mapError(error);
    }
  }

  Future<Map<String, dynamic>> patchJson(
    String path, {
    required Map<String, dynamic> body,
  }) async {
    try {
      final response = await _dio.patch<Map<String, dynamic>>(
        path,
        data: body,
        options: Options(headers: _headers()),
      );
      return response.data ?? const {};
    } on DioException catch (error) {
      throw _mapError(error);
    }
  }

  Future<Map<String, dynamic>> deleteJson(String path) async {
    try {
      final response = await _dio.delete<Map<String, dynamic>>(
        path,
        options: Options(headers: _headers()),
      );
      return response.data ?? const {};
    } on DioException catch (error) {
      throw _mapError(error);
    }
  }

  Map<String, String> _headers() {
    final key = _readApiKey();
    return {
      'Accept': 'application/json',
      if (key != null && key.isNotEmpty) 'Authorization': 'Bearer $key',
    };
  }

  ApiException _mapError(DioException error) {
    final status = error.response?.statusCode;
    if (status == 401) {
      return const ApiException(
        'Phiên đăng nhập không hợp lệ.',
        statusCode: 401,
      );
    }
    if (status == 403) {
      return const ApiException(
        'Bạn không có quyền thực hiện thao tác này.',
        statusCode: 403,
      );
    }
    if (status == 429) {
      return const ApiException(
        'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        statusCode: 429,
      );
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return const ApiException('Kết nối quá thời gian. Vui lòng thử lại.');
    }
    return ApiException(
      status != null && status >= 500
          ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại.'
          : 'Không thể kết nối đến máy chủ.',
      statusCode: status,
    );
  }
}

final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(appConfigProvider);
  return Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
    ),
  );
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    ref.watch(dioProvider),
    () => ref.read(authControllerProvider).apiKey,
  );
});
