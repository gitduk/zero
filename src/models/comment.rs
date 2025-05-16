use time::OffsetDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::utils::sanitize::sanitize_content;

// 数据库中的评论结构
#[derive(Debug, FromRow)]
pub struct Comment {
    pub id: Uuid,
    pub post_id: Uuid,
    pub content: String,

    pub created_at: OffsetDateTime,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

// 为Comment实现自定义序列化，确保content字段经过安全处理
impl Serialize for Comment {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        
        // Format the datetime as ISO string
        let created_at_str = self.created_at.format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| String::from(""));
            
        let mut state = serializer.serialize_struct("Comment", 6)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("post_id", &self.post_id)?;
        state.serialize_field("content", &sanitize_content(&self.content))?;
        state.serialize_field("created_at", &created_at_str)?;
        state.serialize_field("ip_address", &self.ip_address)?;
        state.serialize_field("user_agent", &self.user_agent)?;
        state.end()
    }
}

// 创建新评论的请求结构
#[derive(Debug, Deserialize)]
pub struct CreateCommentRequest {
    #[serde(deserialize_with = "deserialize_and_validate_content")]
    pub content: String,
}

// 验证评论内容的自定义反序列化函数
fn deserialize_and_validate_content<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let content: String = String::deserialize(deserializer)?;
    
    // 验证评论不为空
    if content.trim().is_empty() {
        return Err(serde::de::Error::custom("Comment content cannot be empty"));
    }
    
    // 验证评论长度
    if content.len() > 1000 {
        return Err(serde::de::Error::custom("Comment content is too long (max 1000 characters)"));
    }
    
    Ok(content)
}

// 评论列表响应结构
#[derive(Debug, Serialize)]
pub struct CommentListResponse {
    pub comments: Vec<Comment>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}