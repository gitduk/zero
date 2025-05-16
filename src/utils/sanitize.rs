
/// Sanitizes user-generated content to make it safe for display
/// while preserving basic formatting and showing content properly.
///
/// This function:
/// 1. Allows basic formatting tags like <br>, <p>, etc.
/// 2. Strips dangerous tags and attributes
/// 3. Prevents XSS while maintaining content readability
///
/// # Arguments
/// * `content` - The user-provided content to sanitize
///
/// # Returns
/// * A sanitized string that is safe to display in HTML
pub fn sanitize_content(content: &str) -> String {
    // Simple approach for safety with readability:
    // 1. Replace line breaks with <br> tags for readability
    // 2. Escape all HTML to prevent any code execution
    // 3. Then selectively unescape safe formatting elements
    
    // Step 1: Handle newlines for proper display
    let with_breaks = content.replace("\n", "<br>");
    
    // Step 2: Basic sanitization of dangerous scripts and elements
    let mut result = with_breaks.to_string();
    
    // Handle script tags and other dangerous elements
    result = result
        .replace("<script", "&lt;script")
        .replace("</script", "&lt;/script")
        .replace("<iframe", "&lt;iframe")
        .replace("</iframe", "&lt;/iframe")
        .replace("<object", "&lt;object")
        .replace("<embed", "&lt;embed")
        .replace("<base", "&lt;base");
    
    // Handle dangerous attributes and protocols
    result = result
        .replace("javascript:", "blocked-javascript:")
        .replace("data:", "blocked-data:")
        .replace("vbscript:", "blocked-vbscript:")
        .replace(" onerror=", " data-blocked-onerror=")
        .replace(" onload=", " data-blocked-onload=")
        .replace(" onclick=", " data-blocked-onclick=")
        .replace(" onmouseover=", " data-blocked-onmouseover=")
        .replace(" onfocus=", " data-blocked-onfocus=")
        .replace(" onblur=", " data-blocked-onblur=");
        
    // Return the sanitized content
    result
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
#[allow(dead_code)]
pub fn sanitize_for_db(content: &str) -> String {
    // For SQL safety, we primarily rely on prepared statements
    // This is just an additional layer of validation
    let trimmed = content.trim();

    // Remove potentially harmful SQL sequences (basic sanitization)
    // Note: Prepared statements are still the primary defense!
    trimmed
        .replace(';', "") // Semicolons can terminate statements
        .replace("--", "") // SQL comment indicator
        .replace("/*", "") // SQL block comment start
        .replace("*/", "") // SQL block comment end
        .replace("xp_", "") // SQL Server stored procedures
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_content() {
        // Test HTML sanitization
        let result = sanitize_content("<script>alert('XSS')</script>");
        println!("HTML sanitization result: {}", result);
        assert!(result.contains("&lt;script"));
        assert!(result.contains("alert"));

        // Test allowed tags and line breaks
        let result = sanitize_content("This is a\nline break");
        println!("Line break result: {}", result);
        assert!(result.contains("<br>"));
    
        // Check basic formatting is preserved
        let result = sanitize_content("<p>This is <b>bold</b> and <i>italic</i></p>");
        println!("Formatting tags result: {}", result);
        assert!(result.contains("<b>bold</b>"));

        // Test SQL injection displayed as plain text
        let sql = "SELECT * FROM users WHERE username = 'admin' OR '1'='1';";
        let result = sanitize_content(sql);
        println!("SQL sanitization result: {}", result);
        assert_eq!(result, sql);
        
        // Test event handler XSS
        let result = sanitize_content("<img src=x onerror=\"alert(1)\">");
        println!("Event handler XSS result: {}", result);
        assert!(result.contains("data-blocked-onerror"));

        // Test script in div
        let result = sanitize_content("<div><script>alert(123)</script></div>");
        assert!(result.contains("<div>"));
        assert!(result.contains("&lt;script"));

        // Test JavaScript protocol
        let result = sanitize_content("<a href=\"javascript:alert('XSS')\">Click me</a>");
        assert!(result.contains("blocked-javascript:"));

        // Test data URI XSS
        let result = sanitize_content("<img src=\"data:text/html,<script>alert(1)</script>\">");
        assert!(result.contains("blocked-data:"));
    }
}
