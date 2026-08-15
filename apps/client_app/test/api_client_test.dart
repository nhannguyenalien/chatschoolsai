import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schools_ai_app/core/network/api_client.dart';
import 'package:schools_ai_app/core/network/api_exception.dart';

class MockDio extends Mock implements Dio {}

class FakeOptions extends Fake implements Options {}

void main() {
  setUpAll(() => registerFallbackValue(FakeOptions()));

  test('adds bearer API key without putting it in request body', () async {
    final dio = MockDio();
    Options? capturedOptions;
    when(
      () => dio.get<Map<String, dynamic>>(
        '/api/v1/config',
        options: any(named: 'options'),
      ),
    ).thenAnswer((invocation) async {
      capturedOptions = invocation.namedArguments[#options] as Options;
      return Response(
        requestOptions: RequestOptions(path: '/api/v1/config'),
        data: const {'success': true},
        statusCode: 200,
      );
    });
    final client = ApiClient(dio, () => 'tenant-secret');

    final response = await client.getJson('/api/v1/config');

    expect(response['success'], isTrue);
    expect(capturedOptions!.headers?['Authorization'], 'Bearer tenant-secret');
    expect(capturedOptions!.headers?['Accept'], 'application/json');
  });

  for (final testCase in [
    (status: 401, message: 'Phiên đăng nhập không hợp lệ.'),
    (status: 403, message: 'Bạn không có quyền thực hiện thao tác này.'),
    (status: 429, message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.'),
    (status: 503, message: 'Máy chủ đang gặp sự cố. Vui lòng thử lại.'),
  ]) {
    test('maps HTTP ${testCase.status} to a stable user message', () async {
      final dio = MockDio();
      final request = RequestOptions(path: '/api/v1/config');
      when(
        () => dio.get<Map<String, dynamic>>(
          any(),
          options: any(named: 'options'),
        ),
      ).thenThrow(
        DioException(
          requestOptions: request,
          response: Response(
            requestOptions: request,
            statusCode: testCase.status,
          ),
          type: DioExceptionType.badResponse,
        ),
      );
      final client = ApiClient(dio, () => 'key');

      await expectLater(
        client.getJson('/api/v1/config'),
        throwsA(
          isA<ApiException>()
              .having((error) => error.message, 'message', testCase.message)
              .having(
                (error) => error.statusCode,
                'statusCode',
                testCase.status,
              ),
        ),
      );
    });
  }

  test('maps network timeout without exposing Dio internals', () async {
    final dio = MockDio();
    when(
      () => dio.post<Map<String, dynamic>>(
        any(),
        data: any(named: 'data'),
        options: any(named: 'options'),
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/api/v1/knowledge'),
        type: DioExceptionType.connectionTimeout,
      ),
    );
    final client = ApiClient(dio, () => 'key');

    await expectLater(
      client.postJson('/api/v1/knowledge', body: const {'text': 'x'}),
      throwsA(
        isA<ApiException>().having(
          (error) => error.message,
          'message',
          'Kết nối quá thời gian. Vui lòng thử lại.',
        ),
      ),
    );
  });
}
