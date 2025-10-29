#!/usr/bin/env python3
import sqlite3
import sys

def migrate_data():
    # Connect to both databases
    old_db = sqlite3.connect('nmon.db')
    new_db = sqlite3.connect('network_tests.db')
    
    old_cursor = old_db.cursor()
    new_cursor = new_db.cursor()
    
    print("Starting data migration...")
    
    # Migrate test_configs
    print("Migrating test configurations...")
    old_cursor.execute("SELECT * FROM test_configs")
    configs = old_cursor.fetchall()
    
    for config in configs:
        try:
            new_cursor.execute("""
                INSERT OR REPLACE INTO test_configs 
                (id, name, test_type, target, interval, timeout, enabled, dns_servers, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, config)
        except Exception as e:
            print(f"Error migrating config {config[0]}: {e}")
    
    print(f"Migrated {len(configs)} test configurations")
    
    # Migrate test_results
    print("Migrating test results...")
    old_cursor.execute("SELECT COUNT(*) FROM test_results")
    total_results = old_cursor.fetchone()[0]
    
    old_cursor.execute("SELECT * FROM test_results")
    batch_size = 1000
    migrated = 0
    
    while True:
        results = old_cursor.fetchmany(batch_size)
        if not results:
            break
            
        for result in results:
            try:
                new_cursor.execute("""
                    INSERT OR REPLACE INTO test_results 
                    (id, config_id, timestamp, success, response_time, error, data)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, result)
                migrated += 1
            except Exception as e:
                print(f"Error migrating result {result[0]}: {e}")
        
        if migrated % 1000 == 0:
            print(f"Migrated {migrated}/{total_results} results...")
            new_db.commit()
    
    # Final commit
    new_db.commit()
    
    print(f"Migration complete! Migrated {migrated} test results")
    
    # Verify migration
    new_cursor.execute("SELECT COUNT(*) FROM test_results")
    new_count = new_cursor.fetchone()[0]
    
    new_cursor.execute("SELECT MIN(timestamp), MAX(timestamp) FROM test_results")
    date_range = new_cursor.fetchone()
    
    print(f"New database contains {new_count} results")
    print(f"Date range: {date_range[0]} to {date_range[1]}")
    
    # Close connections
    old_db.close()
    new_db.close()

if __name__ == "__main__":
    migrate_data()
