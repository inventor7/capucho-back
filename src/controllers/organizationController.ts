import { Request, Response } from "express";
import supabaseService from "@/services/supabaseService";
import logger from "@/utils/logger";

class OrganizationController {
  /**
   * Get all organizations for the current user
   * GET /api/organizations
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      // The `get_user_organizations` RPC function should be used if possible for complex data
      // For now, simple query filtered by RLS (handled by Supabase if using service role with RLS simulation?
      // Actually backend uses service key usually so it overrides RLS unless we impersonate).
      // Since we are using `supabaseService` which uses `serviceKey`, we bypass RLS.
      // We MUST filter manually by user_id if we want to simulate "my organizations".

      // OR better, assuming we have a user context (req.user), we find memberships first.

      // TODO: Ensure we have user_id from auth middleware.
      // req.user.id is typical.
      const userId = (req as any).user?.id;

      if (!userId) {
        // If no auth middleware population, return 401
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // 1. Get memberships
      const membersResult = await supabaseService.query(
        "organization_members",
        {
          select: "organization_id, role",
          eq: { user_id: userId },
        }
      );

      if (!membersResult.data || membersResult.data.length === 0) {
        res.json([]);
        return;
      }

      const orgIds = membersResult.data.map((m: any) => m.organization_id);

      // 2. Get orgs
      const orgsResult = await supabaseService
        .getClient()
        .from("organizations")
        .select("*")
        .in("id", orgIds);

      if (orgsResult.error) throw orgsResult.error;

      // 3. Merge roles into orgs
      const orgsWithRoles = orgsResult.data.map((org: any) => {
        const membership = membersResult.data.find(
          (m: any) => m.organization_id === org.id
        );
        return {
          ...org,
          role: membership?.role,
        };
      });

      res.json(orgsWithRoles);
    } catch (error) {
      logger.error("List organizations failed", { error });
      res.status(500).json({ error: "Failed to list organizations" });
    }
  }

  /**
   * Get organization details
   * GET /api/organizations/:id
   */
  async get(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await supabaseService.query("organizations", {
        select: "*",
        eq: { id },
      });

      if (!result.data || result.data.length === 0) {
        res.status(404).json({ error: "Organization not found" });
        return;
      }

      res.json(result.data[0]);
    } catch (error) {
      logger.error("Get organization failed", { error });
      res.status(500).json({ error: "Failed to get organization" });
    }
  }

  /**
   * Create new organization
   * POST /api/organizations
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, slug } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!name || !slug) {
        res.status(400).json({ error: "Name and slug are required" });
        return;
      }

      // 1. Create Org
      const orgResult = await supabaseService.insert("organizations", {
        name,
        slug,
      });
      const org = orgResult[0];

      // 2. Add creator as owner
      await supabaseService.insert("organization_members", {
        organization_id: org.id,
        user_id: userId,
        role: "owner",
      });

      res.status(201).json(org);
    } catch (error) {
      logger.error("Create organization failed", { error });
      res.status(500).json({ error: "Failed to create organization" });
    }
  }

  /**
   * Get organization members
   * GET /api/organizations/:id/members
   */
  async getMembers(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Join with users table to get names/emails
      const result = await supabaseService
        .getClient()
        .from("organization_members")
        .select("*, users(id, email, full_name, avatar_url)")
        .eq("organization_id", id);

      if (result.error) throw result.error;

      res.json(result.data);
    } catch (error) {
      logger.error("Get members failed", { error });
      res.status(500).json({ error: "Failed to get members" });
    }
  }

  /**
   * Add member
   * POST /api/organizations/:id/members
   */
  async addMember(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { email, role } = req.body;

      // 1. Find user by email
      const userResult = await supabaseService.query("users", {
        select: "id",
        eq: { email },
      });

      if (!userResult.data || userResult.data.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const userId = userResult.data[0].id;

      const result = await supabaseService.insert("organization_members", {
        organization_id: id,
        user_id: userId,
        role: role || "member",
      });

      res.json(result[0]);
    } catch (error) {
      logger.error("Add member failed", { error });
      res.status(500).json({ error: "Failed to add member" });
    }
  }

  /**
   * Update member role
   * PUT /api/organizations/:id/members/:userId
   */
  async updateMemberRole(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId, userId } = req.params;
      const { role } = req.body;

      if (!role) {
        res.status(400).json({ error: "Role is required" });
        return;
      }

      const result = await supabaseService.update(
        "organization_members",
        { role },
        { organization_id: orgId, user_id: userId }
      );

      if (!result || result.length === 0) {
        res.status(404).json({ error: "Member not found" });
        return;
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Update member role failed", { error });
      res.status(500).json({ error: "Failed to update member role" });
    }
  }

  /**
   * Remove member from organization
   * DELETE /api/organizations/:id/members/:userId
   */
  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const { id: orgId, userId } = req.params;

      const { error } = await supabaseService
        .getClient()
        .from("organization_members")
        .delete()
        .match({ organization_id: orgId, user_id: userId });

      if (error) throw error;
      res.status(204).send();
    } catch (error) {
      logger.error("Remove member failed", { error });
      res.status(500).json({ error: "Failed to remove member" });
    }
  }
}

export default new OrganizationController();
