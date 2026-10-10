-- Enforce the product bucket configuration even if it existed before setup.
UPDATE storage.buckets
SET public=false, file_size_limit=5242880,
    allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']
WHERE id='supermalhas-products';
