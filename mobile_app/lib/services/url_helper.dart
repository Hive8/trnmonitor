class UrlHelper {
  /// Strips protocol schemes from the server address string to get the raw host.
  static String cleanServerIp(String serverIp) {
    var clean = serverIp.trim();
    if (clean.startsWith('http://')) {
      clean = clean.substring(7);
    } else if (clean.startsWith('https://')) {
      clean = clean.substring(8);
    }
    if (clean.startsWith('ws://')) {
      clean = clean.substring(5);
    } else if (clean.startsWith('wss://')) {
      clean = clean.substring(6);
    }
    return clean;
  }

  /// Determines if the given server address represents a secure production server.
  /// Standard local IPs (e.g. 192.168.*, 10.*, 127.0.0.1, localhost) will use http/ws.
  static bool isSecureServer(String serverIp) {
    final clean = cleanServerIp(serverIp).toLowerCase();
    
    // Explicitly treat monitor.trnllc.com as secure
    if (clean.contains('monitor.trnllc.com')) {
      return true;
    }
    
    // Check if it's a typical local IP address or localhost
    final isLocal = clean.startsWith('localhost') ||
        clean.startsWith('127.0.0.1') ||
        clean.startsWith('192.168.') ||
        clean.startsWith('10.') ||
        clean.startsWith('172.');
        
    // If not local, default to true (production domains should be secure)
    return !isLocal;
  }

  /// Returns the full HTTP/HTTPS URL for the backend.
  static String getHttpUrl(String serverIp) {
    final clean = cleanServerIp(serverIp);
    final scheme = isSecureServer(clean) ? 'https' : 'http';
    return '$scheme://$clean';
  }

  /// Returns the full WS/WSS URL for the backend.
  static String getWsUrl(String serverIp) {
    final clean = cleanServerIp(serverIp);
    final scheme = isSecureServer(clean) ? 'wss' : 'ws';
    return '$scheme://$clean';
  }
}
