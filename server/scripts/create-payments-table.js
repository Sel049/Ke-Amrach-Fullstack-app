import { pool } from '../src/config/database.js';

async function createPaymentsTable() {
  console.log('🔄 Creating payments table...');
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL,
        order_id BIGINT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'ETB',
        status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
        payment_method VARCHAR(50) DEFAULT 'chapa',
        transaction_id VARCHAR(150) NOT NULL UNIQUE,
        chapa_reference VARCHAR(150) NULL,
        payment_url VARCHAR(500) NULL,
        raw_response JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payments_user_id (user_id),
        INDEX idx_payments_order_id (order_id),
        INDEX idx_payments_status (status),
        INDEX idx_payments_tx_id (transaction_id),
        CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ Payments table created successfully!');
  } catch (error) {
    console.error('❌ Error creating payments table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createPaymentsTable();

