use std::net::SocketAddr;

use crate::utils::filter::reload_sensitive_words;
use axum::{
    extract::Extension,
    http::{header, HeaderValue, Method},
    middleware,
    routing::{get, post},
    Router,
};
use dotenv::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod models;
mod routes;
mod schema;
mod utils;

// Security middleware to add headers to responses
async fn add_security_headers(
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next<axum::body::Body>,
) -> axum::response::Response {
    // 获取路径并克隆，因为req会被后续消费
    let path = req.uri().path().to_string();
    let mut response = next.run(req).await;
    
    // 对静态资源添加长缓存和快速访问头
    if path.starts_with("/assets/") || path.contains(".js") || path.contains(".css") || path.contains(".ico") {
        // 静态资源使用更长的缓存
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=31536000, immutable"), // 1年缓存
        );
    } else {
        // 内容安全策略 - 对动态API使用更严格的规则
        response.headers_mut().insert(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static(
                "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https: http:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:; img-src 'self' data: blob: https: http:; style-src 'self' 'unsafe-inline' https: http:; connect-src 'self' ws: wss: https: http:; font-src 'self' data: https: http:; frame-ancestors 'none'"
            ),
        );
        
        // API响应不缓存
        if path.starts_with("/api/") {
            response.headers_mut().insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("no-store, no-cache, must-revalidate"),
            );
        }
    }
    
    // 通用安全头
    response.headers_mut().insert(
        header::X_XSS_PROTECTION,
        HeaderValue::from_static("1; mode=block"),
    );
    
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    
    response.headers_mut().insert(
        header::X_FRAME_OPTIONS,
        HeaderValue::from_static("DENY"),
    );
    
    response.headers_mut().insert(
        "Referrer-Policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    
    // 添加性能相关头
    response.headers_mut().insert(
        "X-DNS-Prefetch-Control",
        HeaderValue::from_static("on"),
    );
    
    response
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 加载环境变量
    dotenv().ok();

    // 初始化日志 - 生产环境优化格式
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,zero=info,tower_http=warn".into()),
        )
        .with(
            tracing_subscriber::fmt::layer()
                .with_target(true)
                .with_level(true)
                .without_time()
                .compact()
        )
        .init();

    // 创建数据库连接池
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(20) // 增加连接数，提高并发处理能力
        .acquire_timeout(std::time::Duration::from_secs(5)) // 获取连接超时设置
        .idle_timeout(std::time::Duration::from_secs(180)) // 空闲连接超时，释放长时间不用的连接
        .max_lifetime(std::time::Duration::from_secs(1800)) // 连接最大生命周期，防止连接泄漏
        .connect(&database_url)
        .await?;

    tracing::info!("✅ 数据库连接成功 - 连接地址: {}", database_url);

    // 运行数据库迁移
    sqlx::migrate!("./migrations").run(&pool).await?;

    // 加载敏感词列表
    match reload_sensitive_words() {
        Ok(count) => tracing::info!("成功加载敏感词列表，共 {} 个词", count),
        Err(err) => tracing::warn!("无法加载敏感词列表: {}", err),
    }

    // 配置 CORS
    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE])
        .allow_origin(Any);

    // API 路由
    let api_routes = Router::new()
        .route("/posts", get(routes::post::get_posts))
        .route("/posts", post(routes::post::create_post))
        .route("/posts/:id", get(routes::post::get_post))
        .route("/posts/:id/comments", get(routes::comment::get_comments))
        .route("/posts/:id/comments", post(routes::comment::create_comment))
        .nest("/filter", routes::filter::filter_routes())
        .layer(Extension(pool.clone()))
        .layer(cors.clone());

    // 静态文件服务 - 添加优化配置
    let static_files_service = ServeDir::new("static")
        .append_index_html_on_directories(true)
        .precompressed_br()
        .precompressed_gzip()
        .with_buf_chunk_size(16384); // 增加缓冲区大小加快传输

    // 创建应用路由
    let app = Router::new()
        .nest("/api", api_routes)
        .fallback_service(static_files_service)
        .layer(CompressionLayer::new()) // 添加压缩中间件，减少传输数据量
        .layer(middleware::from_fn(add_security_headers)) // 添加安全头
        .layer(SetResponseHeaderLayer::if_not_present(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=86400"), // 增加缓存时间到1天
        )) 
        .layer(cors);

    // 获取服务地址
    let addr = env::var("SERVER_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".to_string());
    let addr: SocketAddr = addr.parse()?;

    tracing::info!("🚀 服务启动成功 - 监听地址: {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
