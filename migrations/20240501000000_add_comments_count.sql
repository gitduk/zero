-- Add comments_count field to posts table
ALTER TABLE posts ADD COLUMN comments_count INTEGER NOT NULL DEFAULT 0;

-- Update existing posts with correct comment counts
UPDATE posts p SET comments_count = (
    SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id
);

-- Create trigger function to update comments_count
CREATE OR REPLACE FUNCTION update_post_comments_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_post_comments_count_trigger
AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Create index for comments_count to improve sorting performance
CREATE INDEX IF NOT EXISTS idx_posts_comments_count ON posts(comments_count DESC);