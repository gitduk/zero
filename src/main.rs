use std::net::SocketAddr;

use axum::{
    extract::Extension,
    http::{header, Method},
    routing::{get, post},
    Router,
};
use dotenv::dotenv;
use sqlx::postgres::PgPoolOptions;
use std::env;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod models;
mod routes;
mod schema;
mod utils;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 加载环境变量
    dotenv().ok();

    // 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 创建数据库连接池
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    // 运行数据库迁移
    sqlx::migrate!("./migrations").run(&pool).await?;

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
        .layer(Extension(pool.clone()))
        .layer(cors.clone());

    // 静态文件服务
    let static_files_service = ServeDir::new("static");

    // 创建应用路由
    let app = Router::new()
        .nest("/api", api_routes)
        .fallback_service(static_files_service)
        .layer(cors);

    // 获取服务地址
    let addr = env::var("SERVER_ADDR").unwrap_or_else(|_| "127.0.0.1:3000".to_string());
    let addr: SocketAddr = addr.parse()?;

    tracing::info!("Starting server at {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}

