import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import 'utils.dart' show formatDate, parseDate;

/// Authentication service for managing user sessions
class AuthService extends BaseService {
  final http.Client _client;
  static const String API_BASE = 'https://api.example.com';

  AuthService(this._client);

  /// Authenticates a user with email and password
  Future<User> login(String email, String password) async {
    final response = await _client.post(
      Uri.parse('$API_BASE/login'),
      body: {'email': email, 'password': password},
    );

    if (response.statusCode == 200) {
      return User.fromJson(response.body);
    } else {
      throw Exception('Login failed');
    }
  }

  /// Logs out the current user
  Future<void> logout() async {
    await _client.post(Uri.parse('$API_BASE/logout'));
  }

  static String formatToken(String token) {
    return token.trim().toUpperCase();
  }
}

/// Initializes the application
Future<void> initializeApp() async {
  // Setup code here
  print('App initialized');
}

const int MAX_RETRIES = 3;
final String apiKey = 'secret_key';
