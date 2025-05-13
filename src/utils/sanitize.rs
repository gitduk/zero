/// Sanitizes user-generated content to make it safe for display
/// while preserving the original text (including SQL injection attempts).
/// This doesn't block content but ensures it is displayed as plain text.
///
/// This function:
/// 1. Only escapes specific HTML characters (< and >) that could lead to XSS
/// 2. Preserves quotes and other characters that are needed for SQL examples
///
/// # Arguments
/// * `content` - The user-provided content to sanitize
///
/// # Returns
/// * A sanitized string that is safe to display in HTML
pub fn sanitize_content(content: &str) -> String {
    // Only convert angle brackets to prevent script execution
    // but keep other characters (like quotes) as they are
    content
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Sanitizes content for database insertion
/// Note: This should be used in addition to prepared statements,
/// not as a replacement!
///
/// # Arguments
/// * `content` - The user-provided content to sanitize
///
/// # Returns
/// * A sanitized string that is safer to use with databases
pub fn _sanitize_for_db(content: &str) -> String {
    // For SQL safety, we primarily rely on prepared statements
    // This is just an additional layer of validation
    content.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_content() {
        // Test HTML sanitization
        assert_eq!(
            sanitize_content("<script>alert('XSS')</script>"),
            "&lt;script&gt;alert('XSS')&lt;/script&gt;"
        );

        // Test SQL injection sanitization (displayed as plain text)
        assert_eq!(
            sanitize_content("SELECT * FROM users WHERE username = 'admin' OR '1'='1';"),
            "SELECT * FROM users WHERE username = 'admin' OR '1'='1';"
        );
    }
}

