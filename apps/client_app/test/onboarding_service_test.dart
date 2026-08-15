import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:schools_ai_app/core/auth/onboarding_service.dart';

class MockDio extends Mock implements Dio {}

void main() {
  setUpAll(() {
    registerFallbackValue(Options());
  });

  test('register normalizes input and maps the provisioned bot', () async {
    final dio = MockDio();
    when(
      () => dio.post<Map<String, dynamic>>(
        '/api/onboarding/register',
        data: any(named: 'data'),
        options: any(named: 'options'),
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/api/onboarding/register'),
        statusCode: 201,
        data: const {
          'api_key': 'sk_new',
          'tenant': 'school-bot',
          'bot_name': 'Tư vấn viên',
          'display_name': 'Nguyễn An',
        },
      ),
    );

    final result = await OnboardingService(dio, () => null).register(
      name: '  Nguyễn An ',
      email: ' an@example.com ',
      password: 'password123',
      tenant: ' school-bot ',
      botName: ' Tư vấn viên ',
    );

    expect(result.apiKey, 'sk_new');
    expect(result.tenant, 'school-bot');
    final captured =
        verify(
              () => dio.post<Map<String, dynamic>>(
                '/api/onboarding/register',
                data: captureAny(named: 'data'),
                options: any(named: 'options'),
              ),
            ).captured.single
            as Map<String, dynamic>;
    expect(captured['email'], 'an@example.com');
    expect(captured['bot_name'], 'Tư vấn viên');
  });

  test('create bot authenticates with the active bot key', () async {
    final dio = MockDio();
    when(
      () => dio.post<Map<String, dynamic>>(
        '/api/v1/bots',
        data: any(named: 'data'),
        options: any(named: 'options'),
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/api/v1/bots'),
        statusCode: 201,
        data: const {
          'api_key': 'sk_second',
          'tenant': 'second-bot',
          'bot_name': 'Bot 2',
        },
      ),
    );

    await OnboardingService(
      dio,
      () => 'sk_current',
    ).createBot(tenant: 'second-bot', botName: 'Bot 2');

    final options =
        verify(
              () => dio.post<Map<String, dynamic>>(
                '/api/v1/bots',
                data: any(named: 'data'),
                options: captureAny(named: 'options'),
              ),
            ).captured.single
            as Options;
    expect(options.headers?['Authorization'], 'Bearer sk_current');
  });

  test('surfaces the API validation message', () async {
    final dio = MockDio();
    when(
      () => dio.post<Map<String, dynamic>>(
        any(),
        data: any(named: 'data'),
        options: any(named: 'options'),
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/api/v1/bots'),
        response: Response(
          requestOptions: RequestOptions(path: '/api/v1/bots'),
          statusCode: 409,
          data: const {'error': 'Mã bot đã được sử dụng'},
        ),
      ),
    );

    expect(
      () => OnboardingService(
        dio,
        () => 'key',
      ).createBot(tenant: 'duplicate', botName: 'Bot'),
      throwsA(
        isA<OnboardingException>().having(
          (error) => error.message,
          'message',
          'Mã bot đã được sử dụng',
        ),
      ),
    );
  });
}
