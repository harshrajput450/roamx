import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getServerConfig } from './config/env';

let supabaseClient: SupabaseClient | null = null;

export const BUCKET_NAME = 'roamx-media';

/**
 * Validate Supabase environment configuration.
 * Never logs actual keys/secrets.
 */
export function validateSupabaseConfig(): boolean {
  const config = getServerConfig();

  const hasUrl = Boolean(config.SUPABASE_URL);
  const hasAnonKey = Boolean(config.SUPABASE_ANON_KEY);
  const hasServiceRoleKey = Boolean(config.SUPABASE_SERVICE_ROLE_KEY);
  const hasSupabaseKey = Boolean(config.SUPABASE_KEY);

  console.log('🔎 SUPABASE CONFIG CHECK:', {
    hasUrl,
    hasAnonKey,
    hasServiceRoleKey,
    hasSupabaseKey,
  });

  if (!hasUrl) {
    console.error('❌ CRITICAL: SUPABASE_URL is missing.');
  }

  if (!hasAnonKey && !hasServiceRoleKey) {
    console.error(
      '❌ CRITICAL: Neither SUPABASE_ANON_KEY nor SUPABASE_SERVICE_ROLE_KEY is configured.'
    );
  }

  if (!hasServiceRoleKey && hasAnonKey) {
    console.warn(
      '⚠️ SUPABASE_SERVICE_ROLE_KEY is missing. Server is using SUPABASE_ANON_KEY.'
    );
  }

  if (hasUrl && hasSupabaseKey) {
    console.log('✅ Supabase environment configuration is present.');
    console.log(`   URL: ${config.SUPABASE_URL}`);
    console.log(
      `   Auth Strategy: ${
        hasServiceRoleKey ? 'Service Role Key' : 'Anon Key'
      }`
    );
    return true;
  }

  console.error('❌ Supabase configuration is incomplete.');
  return false;
}

/**
 * Returns true when the minimum Supabase configuration is available.
 */
export function isSupabaseConfigured(): boolean {
  const config = getServerConfig();

  return Boolean(
    config.SUPABASE_URL &&
      (config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY)
  );
}

/**
 * Get or initialize the Supabase server client.
 */
export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = getServerConfig();

  const hasUrl = Boolean(config.SUPABASE_URL);
  const hasAnonKey = Boolean(config.SUPABASE_ANON_KEY);
  const hasServiceRoleKey = Boolean(config.SUPABASE_SERVICE_ROLE_KEY);
  const hasSupabaseKey = Boolean(config.SUPABASE_KEY);

  console.log('🔎 SUPABASE CONFIG CHECK:', {
    hasUrl,
    hasAnonKey,
    hasServiceRoleKey,
    hasSupabaseKey,
  });

  if (!hasUrl) {
    console.error('❌ Supabase connection failed: SUPABASE_URL is missing.');
    return null;
  }

  if (!hasSupabaseKey) {
    console.error(
      '❌ Supabase connection failed: no Supabase key is configured.'
    );
    return null;
  }

  try {
    supabaseClient = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    console.log('✅ Supabase Client initialized successfully.');

    return supabaseClient;
  } catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);

    supabaseClient = null;

    return null;
  }
}

/**
 * Check whether a string is a base64 image data URL.
 */
export function isBase64DataUrl(str: string): boolean {
  return typeof str === 'string' && str.startsWith('data:image/');
}

/**
 * Upload a base64 image to Supabase Storage.
 */
export async function uploadImageToStorage(
  base64OrUrl: string,
  folder: 'trips' | 'reviews' | 'avatars' = 'trips'
): Promise<string> {
  // Already a normal URL — nothing to upload.
  if (!isBase64DataUrl(base64OrUrl)) {
    return base64OrUrl;
  }

  const supabase = getSupabase();

  if (!supabase) {
    console.warn(
      '⚠️ Supabase is not configured. Keeping original image data.'
    );

    return base64OrUrl;
  }

  try {
    const matches = base64OrUrl.match(
      /^data:([A-Za-z-+\/]+);base64,(.+)$/
    );

    if (!matches || matches.length !== 3) {
      console.warn('⚠️ Invalid base64 image data.');
      return base64OrUrl;
    }

    const contentType = matches[1];
    const base64Data = matches[2];

    const buffer = Buffer.from(base64Data, 'base64');

    let ext = 'jpg';

    if (contentType.includes('png')) {
      ext = 'png';
    } else if (contentType.includes('webp')) {
      ext = 'webp';
    } else if (contentType.includes('gif')) {
      ext = 'gif';
    }

    const fileName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}.${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(
        `❌ Error uploading to Supabase Storage bucket "${BUCKET_NAME}":`,
        error.message
      );

      return base64OrUrl;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    console.log('✅ Image uploaded successfully to Supabase Storage.');

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(
      '❌ Exception during Supabase Storage upload:',
      error
    );

    return base64OrUrl;
  }
}

/**
 * Delete an image from Supabase Storage.
 */
export async function deleteImageFromStorage(
  imageUrl: string
): Promise<boolean> {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return false;
  }

  const supabase = getSupabase();

  if (!supabase) {
    console.error(
      '❌ Cannot delete image: Supabase is not configured.'
    );

    return false;
  }

  try {
    const bucketMarker = `/storage/v1/object/public/${BUCKET_NAME}/`;

    const markerIndex = imageUrl.indexOf(bucketMarker);

    if (markerIndex === -1) {
      return false;
    }

    const filePath = imageUrl.substring(
      markerIndex + bucketMarker.length
    );

    if (!filePath) {
      return false;
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error(
        `❌ Error deleting file "${filePath}" from Supabase Storage:`,
        error.message
      );

      return false;
    }

    console.log('🗑️ Image deleted from Supabase Storage.');

    return true;
  } catch (error) {
    console.error(
      '❌ Exception during Supabase Storage deletion:',
      error
    );

    return false;
  }
}