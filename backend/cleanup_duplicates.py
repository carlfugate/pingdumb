#!/usr/bin/env python3
import sqlite3

def cleanup_duplicates():
    conn = sqlite3.connect('network_tests.db')
    cursor = conn.cursor()
    
    print("Finding duplicate configurations...")
    
    # Find duplicates by name, test_type, target
    cursor.execute("""
        SELECT name, test_type, target, GROUP_CONCAT(id) as ids, COUNT(*) as count
        FROM test_configs 
        GROUP BY name, test_type, target 
        HAVING count > 1
    """)
    
    duplicates = cursor.fetchall()
    
    for name, test_type, target, ids, count in duplicates:
        id_list = ids.split(',')
        keep_id = id_list[0]  # Keep the first one
        remove_ids = id_list[1:]  # Remove the rest
        
        print(f"Duplicate found: {name} ({test_type} -> {target})")
        print(f"  Keeping: {keep_id}")
        print(f"  Removing: {', '.join(remove_ids)}")
        
        # Delete duplicate configs
        for remove_id in remove_ids:
            cursor.execute("DELETE FROM test_configs WHERE id = ?", (remove_id,))
            
        # Update test_results to point to the kept config
        for remove_id in remove_ids:
            cursor.execute("""
                UPDATE test_results 
                SET config_id = ? 
                WHERE config_id = ?
            """, (keep_id, remove_id))
    
    conn.commit()
    
    # Verify cleanup
    cursor.execute("SELECT COUNT(*) FROM test_configs")
    config_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM test_results")
    result_count = cursor.fetchone()[0]
    
    print(f"\nCleanup complete!")
    print(f"Configurations: {config_count}")
    print(f"Test results: {result_count}")
    
    conn.close()

if __name__ == "__main__":
    cleanup_duplicates()
