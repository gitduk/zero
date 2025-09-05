
use ammonia::Builder as AmmoniaBuilder;
use lazy_static::lazy_static;

lazy_static! {
    // A single, reusable sanitizer policy for all content
    static ref SANITIZER: ammonia::Builder<'static> = {
        let mut builder = AmmoniaBuilder::default();
        // Allow a minimal, safe set of tags
        builder
            .tags([
                "a", "b", "strong", "i", "em", "code", "pre",
                "p", "br", "ul", "ol", "li", "blockquote",
            ])
            // Only allow safe attributes on anchors
            .generic_attributes(["title"]).link_rel(Some("nofollow noreferrer noopener"))
            .allowed_classes(ammonia::collections::HashSet::new())
            .link_attributes(["href"]) // restrict to href only
            // Only safe URL schemes for links (disallow javascript:, data:, vbscript:)
            .url_schemes([
                "http", "https", "mailto",
            ]);
        builder
    };
}

/// Sanitizes user-generated content to make it safe for display
/// while preserving basic formatting (e.g., line breaks and simple tags).
pub fn sanitize_content(content: &str) -> String {
    // Convert newlines to <br> for readability before sanitization.
    // The sanitizer will keep <br> because it's in the allowlist.
    let with_breaks = content.replace('\n', "<br>");

    // Clean using a strict allowlist policy.
    // - Removes event handlers (onload, onerror, etc.)
    // - Removes style and other unsafe attributes
    // - Strips dangerous tags (script, iframe, etc.)
    // - Rejects javascript: / data: / vbscript: URLs
    SANITIZER.clean(&with_breaks).to_string()
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
        // <script> should be removed entirely
        let result = sanitize_content("<script>alert('XSS')</script>");
        assert!(!result.to_lowercase().contains("<script"));
        assert!(!result.to_lowercase().contains("javascript:"));

        // Line breaks should be preserved
        let result = sanitize_content("This is a\nline break");
        assert!(result.contains("<br>"));

        // Basic formatting preserved
        let result = sanitize_content("<p>This is <b>bold</b> and <i>italic</i></p>");
        assert!(result.contains("<b>bold</b>"));

        // Plain strings stay intact
        let sql = "SELECT * FROM users WHERE username = 'admin' OR '1'='1';";
        let result = sanitize_content(sql);
        assert_eq!(result, sql);

        // Event handlers are stripped
        let result = sanitize_content("<img src=x onerror=\"alert(1)\">");
        assert!(!result.to_lowercase().contains("onerror"));

        // javascript: protocol is removed
        let result = sanitize_content("<a href=\"javascript:alert('XSS')\">Click me</a>");
        assert!(!result.to_lowercase().contains("javascript:"));

        // data: uri should not pass for src/href
        let result = sanitize_content("<img src=\"data:text/html,<script>alert(1)</script>\">");
        assert!(!result.to_lowercase().contains("data:"));
    }
}
