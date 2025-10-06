import { createClient, SupabaseClient } from "@supabase/supabase-js";
import config from "@/config";
import { ISupabaseService, DatabaseError } from "@/types";
import logger from "@/utils/logger";

class SupabaseService implements ISupabaseService {
  private client: SupabaseClient;
  private storageClient: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.key);

    // Use service role key for storage operations if available
    this.storageClient = createClient(
      config.supabase.url,
      config.supabase.serviceKey || config.supabase.key
    );

    logger.info("Supabase service initialized", {
      url: config.supabase.url,
      bucket: config.supabase.bucketName,
    });
  }

  async query(table: string, options: any = {}): Promise<any> {
    console.log("====== QUERY START ======");
    console.log("Table:", table);
    console.log("Options:", JSON.stringify(options, null, 2));

    try {
      // Handle count queries separately
      if (options.count) {
        console.log("Executing COUNT query");
        let countQuery = this.client
          .from(table)
          .select(options.select || "*", { count: options.count, head: true });

        // Apply filters
        if (options.match && Object.keys(options.match).length > 0) {
          console.log("Applying match filter:", options.match);
          countQuery = countQuery.match(options.match);
        }

        if (options.eq) {
          console.log("Applying eq filter:", options.eq);
          Object.entries(options.eq).forEach(([key, value]) => {
            countQuery = countQuery.eq(key, value as any);
          });
        }

        const { count, error } = await countQuery;

        if (error) {
          console.error("====== COUNT QUERY ERROR ======");
          console.error("Table:", table);
          console.error("Error object:", error);
          console.error("Error message:", error.message);
          console.error("Error code:", error.code);
          console.error("Error details:", error.details);
          console.error("Error hint:", error.hint);
          console.error("==============================");

          logger.error(
            `Supabase count query error [table: ${table}] - ${
              error.message
            } (code: ${error.code}, details: ${JSON.stringify(
              error.details
            )}, hint: ${error.hint})`,
            {
              options,
            }
          );
          throw new DatabaseError(`Count query failed: ${error.message}`);
        }

        console.log("Count query successful. Count:", count);
        return { data: null, count };
      }

      // Regular query
      console.log("Executing REGULAR query");
      let queryBuilder = this.client.from(table).select(options.select || "*");

      // Apply filters
      if (options.match && Object.keys(options.match).length > 0) {
        console.log("Applying match filter:", options.match);
        queryBuilder = queryBuilder.match(options.match);
      }

      if (options.eq) {
        console.log("Applying eq filter:", options.eq);
        Object.entries(options.eq).forEach(([key, value]) => {
          queryBuilder = queryBuilder.eq(key, value as any);
        });
      }

      if (options.gt) {
        console.log("Applying gt filter:", options.gt);
        Object.entries(options.gt).forEach(([key, value]) => {
          queryBuilder = queryBuilder.gt(key, value as any);
        });
      }

      // Apply ordering
      if (!options.count && options.order?.column) {
        queryBuilder = queryBuilder.order(options.order.column, {
          ascending: options.order.ascending !== false,
        });
      }

      // Apply limit
      if (!options.count) {
        queryBuilder = queryBuilder.limit(options.limit || 100);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error("====== REGULAR QUERY ERROR ======");
        console.error("Table:", table);
        console.error("Error object:", error);
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error details:", error.details);
        console.error("Error hint:", error.hint);
        console.error("=================================");

        logger.error(`TEST ERROR MESSAGE: ${error.message}`, {});
        throw new DatabaseError(`Query failed: ${error.message}`);
      }

      console.log("Query successful. Rows:", data?.length);
      return { data, count: null };
    } catch (error) {
      console.error("====== CATCH BLOCK ERROR ======");
      console.error("Error:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      console.error("===============================");

      logger.error(
        `Supabase service query error [table: ${table}] - ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          options,
        }
      );
      throw error;
    }
  }

  async insert(table: string, data: any): Promise<any> {
    try {
      const { data: result, error } = await this.client
        .from(table)
        .insert(data)
        .select();

      if (error) {
        logger.error("Supabase insert error", { table, data, error });
        throw new DatabaseError(`Insert failed: ${error.message}`);
      }

      return result;
    } catch (error) {
      logger.error("Supabase service insert error", { table, data, error });
      throw error;
    }
  }

  async update(table: string, data: any, filter: any): Promise<any> {
    try {
      let query = this.client.from(table).update(data);

      // Apply filters
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: result, error } = await query.select();

      if (error) {
        logger.error("Supabase update error", { table, data, filter, error });
        throw new DatabaseError(`Update failed: ${error.message}`);
      }

      return result;
    } catch (error) {
      logger.error("Supabase service update error", {
        table,
        data,
        filter,
        error,
      });
      throw error;
    }
  }

  async delete(table: string, filter: any): Promise<any> {
    try {
      let query = this.client.from(table).delete();

      // Apply filters
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { error } = await query;

      if (error) {
        logger.error("Supabase delete error", { table, filter, error });
        throw new DatabaseError(`Delete failed: ${error.message}`);
      }

      return { success: true };
    } catch (error) {
      logger.error("Supabase service delete error", { table, filter, error });
      throw error;
    }
  }

  // Storage operations
  async uploadFile(
    fileName: string,
    buffer: Buffer,
    contentType: string = "application/zip"
  ): Promise<string> {
    try {
      const { data, error } = await this.storageClient.storage
        .from(config.supabase.bucketName)
        .upload(fileName, buffer, {
          contentType,
          upsert: false,
        });

      if (error) {
        logger.error("Supabase storage upload error", { fileName, error });
        throw new DatabaseError(`File upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.storageClient.storage
        .from(config.supabase.bucketName)
        .getPublicUrl(fileName);

      logger.info("File uploaded to Supabase storage", {
        fileName,
        url: urlData.publicUrl,
      });
      return urlData.publicUrl;
    } catch (error) {
      logger.error("Supabase service file upload error", { fileName, error });
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from("updates")
        .select("id")
        .limit(1);

      return !error;
    } catch (error) {
      logger.error("Supabase health check failed", { error });
      return false;
    }
  }

  // Get client instances for advanced operations
  getClient(): SupabaseClient {
    return this.client;
  }

  getStorageClient(): SupabaseClient {
    return this.storageClient;
  }
}

// Export singleton instance
export default new SupabaseService();
