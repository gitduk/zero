use lazy_static::lazy_static;
use std::collections::HashSet;
use std::fs::File;
use std::io::{self, BufRead};
use std::path::Path;
use std::sync::RwLock;

lazy_static! {
    /// 敏感词列表
    static ref SENSITIVE_WORDS: RwLock<HashSet<String>> = {
        let words = load_sensitive_words().unwrap_or_else(|e| {
            eprintln!("警告: 无法加载敏感词列表文件: {}，将使用空列表", e);
            HashSet::new()
        });
        RwLock::new(words)
    };
}

/// 从文件加载敏感词列表
///
/// # Returns
/// * 敏感词集合，或者错误
fn load_sensitive_words() -> io::Result<HashSet<String>> {
    let filter_path = Path::new("filter.txt");
    tracing::debug!("尝试从 {:?} 加载敏感词列表", filter_path);
    let file = File::open(filter_path)?;
    let reader = io::BufReader::new(file);

    let mut words = HashSet::new();
    for line in reader.lines() {
        let line = line?;
        let trimmed = line.trim();
        // 跳过空行和注释行（以#开头）
        if !trimmed.is_empty() && !trimmed.starts_with('#') {
            tracing::debug!("添加敏感词: {}", trimmed);
            words.insert(trimmed.to_string());
        }
    }

    tracing::debug!("成功加载 {} 个敏感词", words.len());
    Ok(words)
}

/// 重新加载敏感词列表
///
/// # Returns
/// * 成功加载的敏感词数量，或者错误
pub fn reload_sensitive_words() -> io::Result<usize> {
    let words = load_sensitive_words()?;
    let count = words.len();

    // 使用写锁更新词表
    let mut sensitive_words = SENSITIVE_WORDS.write().unwrap();
    *sensitive_words = words;

    Ok(count)
}

/// 过滤内容中的敏感词，用 * 替换
///
/// # Arguments
/// * `content` - 要过滤的内容
///
/// # Returns
/// * 过滤后的内容
pub fn filter_sensitive_words(content: &str) -> String {
    // 如果内容为空，直接返回
    if content.is_empty() {
        tracing::debug!("内容为空，不需要过滤");
        return content.to_string();
    }
    
    tracing::debug!("开始处理内容: '{}'", content);

    let mut filtered = content.to_string();
    let mut found_words = Vec::new();

    // 使用读锁访问词表
    let sensitive_words = match SENSITIVE_WORDS.read() {
        Ok(guard) => guard,
        Err(e) => {
            tracing::error!("获取敏感词读锁失败: {}", e);
            return content.to_string(); // 失败时返回原始内容
        }
    };

    // 按长度排序敏感词（从长到短），避免短词是长词子串时的问题
    tracing::debug!("敏感词表中共有 {} 个词", sensitive_words.len());
    let mut sorted_words: Vec<&String> = sensitive_words.iter().collect();
    sorted_words.sort_by(|a, b| b.chars().count().cmp(&a.chars().count()));
    
    for word in &sorted_words {
        tracing::debug!("检查敏感词: '{}'", word);
        if filtered.contains(*word) {
            let char_count = word.chars().count();
            tracing::debug!("找到敏感词 '{}', 字符数量: {}", word, char_count);
            let replacement = "*".repeat(char_count);
            tracing::debug!("替换为: '{}'", replacement);
            filtered = filtered.replace(*word, &replacement);
            found_words.push((*word).clone());
        }
    }

    // 记录发现的敏感词
    if !found_words.is_empty() {
        tracing::info!("发现并过滤了敏感词: {:?}", found_words);
    } else {
        tracing::debug!("未找到敏感词");
    }

    tracing::debug!("过滤后的内容: '{}'", filtered);
    filtered
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    fn create_test_filter_file(content: &str) -> io::Result<()> {
        let mut file = File::create("filter.txt")?;
        file.write_all(content.as_bytes())?;
        Ok(())
    }

    #[test]
    fn test_load_sensitive_words() {
        let content = "# 测试敏感词\n政治\n笨蛋\n\n# 注释行\n暴力";
        create_test_filter_file(content).unwrap();

        let words = load_sensitive_words().unwrap();
        assert_eq!(words.len(), 3);
        assert!(words.contains("政治"));
        assert!(words.contains("笨蛋"));
        assert!(words.contains("暴力"));
        assert!(!words.contains("# 测试敏感词"));
        assert!(!words.contains("# 注释行"));
    }

    #[test]
    fn test_filter_sensitive_words() {
        let content = "政治\n笨蛋\n暴力\n国家机密\n国家";
        create_test_filter_file(content).unwrap();
        reload_sensitive_words().unwrap();

        assert_eq!(filter_sensitive_words("这是正常内容"), "这是正常内容");
        assert_eq!(filter_sensitive_words("这里有政治内容"), "这里有**内容");
        assert_eq!(filter_sensitive_words("这个人真是个笨蛋"), "这个人真是个**");
        assert_eq!(
            filter_sensitive_words("这里有政治内容，那个人是个笨蛋"),
            "这里有**内容，那个人是个**"
        );

        // 测试多个敏感词和重叠敏感词的情况
        assert_eq!(filter_sensitive_words("政治政治政治"), "******");

        // 测试按长度排序替换的逻辑（应该先替换"国家机密"再替换"国家"）
        assert_eq!(
            filter_sensitive_words("这里有国家机密和国家信息"),
            "这里有****和**信息"
        );
    }

    #[test]
    fn test_overlapping_sensitive_words() {
        // 测试重叠的敏感词
        let content = "犯罪\n犯罪分子\n暴力犯罪";
        create_test_filter_file(content).unwrap();
        reload_sensitive_words().unwrap();

        let result = filter_sensitive_words("他是一个暴力犯罪分子");
        // 应该优先替换最长的词组
        assert_eq!(result, "他是一个*****");
    }
}

