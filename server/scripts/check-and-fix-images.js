#!/usr/bin/env node
/**
 * Check and fix listing images in the database
 */

import { pool } from '../src/config/database.js';

async function checkAndFixImages() {
  try {
    console.log('🔍 Checking listing images...');
    
    // Check current listings and their images
    const [listings] = await pool.query(`
      SELECT 
        pl.id, 
        pl.title, 
        li.url as image_url,
        li.id as image_id
      FROM produce_listings pl 
      LEFT JOIN listing_images li ON pl.id = li.listing_id 
      ORDER BY pl.id
    `);
    
    console.log('📊 Current listings and images:');
    listings.forEach(listing => {
      console.log(`ID: ${listing.id}, Title: ${listing.title}, Image: ${listing.image_url || 'NULL'}`);
    });
    
    // Add some test images for the listings
    const testImages = [
      {
        listingId: 5,
        imageUrl: 'https://images.pexels.com/photos/4110256/pexels-photo-4110256.jpeg',
        description: 'Fresh Tomatoes'
      },
      {
        listingId: 6,
        imageUrl: 'https://images.pexels.com/photos/4110256/pexels-photo-4110256.jpeg',
        description: 'Green Beans'
      },
      {
        listingId: 7,
        imageUrl: 'https://images.pexels.com/photos/4110256/pexels-photo-4110256.jpeg',
        description: 'Red Onions'
      }
    ];
    
    console.log('\n🖼️ Adding test images...');
    
    for (const testImage of testImages) {
      // Check if image already exists
      const [existingImages] = await pool.query(
        'SELECT id FROM listing_images WHERE listing_id = ?',
        [testImage.listingId]
      );
      
      if (existingImages.length === 0) {
        // Add the image
        await pool.query(
          'INSERT INTO listing_images (listing_id, url, sort_order) VALUES (?, ?, 0)',
          [testImage.listingId, testImage.imageUrl]
        );
        console.log(`✅ Added image for listing ${testImage.listingId}: ${testImage.description}`);
      } else {
        console.log(`⚠️ Image already exists for listing ${testImage.listingId}`);
      }
    }
    
    // Check the results
    console.log('\n📊 Updated listings and images:');
    const [updatedListings] = await pool.query(`
      SELECT 
        pl.id, 
        pl.title, 
        li.url as image_url
      FROM produce_listings pl 
      LEFT JOIN listing_images li ON pl.id = li.listing_id 
      ORDER BY pl.id
    `);
    
    updatedListings.forEach(listing => {
      console.log(`ID: ${listing.id}, Title: ${listing.title}, Image: ${listing.image_url || 'NULL'}`);
    });
    
    console.log('\n🎉 Image check and fix completed!');
    
  } catch (error) {
    console.error('❌ Error checking/fixing images:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
checkAndFixImages();
