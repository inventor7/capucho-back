import { Request, Response, NextFunction } from "express";
import supabaseService from "@/services/supabaseService";
import { AppError } from "@/types";

class AuthController {
  /**
   * Login user
   * POST /api/auth/login
   */
  public async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError("Email and password are required", 400);
      }

      const { data, error } = await supabaseService
        .getClient()
        .auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        throw new AppError(error.message, 401);
      }

      res.status(200).json({
        success: true,
        token: data.session?.access_token,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Register new user
   * POST /api/auth/register
   */
  public async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError("Email and password are required", 400);
      }

      const { data, error } = await supabaseService.getClient().auth.signUp({
        email,
        password,
      });

      if (error) {
        throw new AppError(error.message, 400);
      }

      // If email confirmation is enabled, session might be null
      const token = data.session?.access_token;

      res.status(201).json({
        success: true,
        message: !token
          ? "Registration successful. Please confirm your email."
          : "Registration successful.",
        token,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile with organizations and apps
   * GET /api/auth/me
   */
  public async me(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        throw new AppError("User not found", 401);
      }

      // Get user's organizations
      const { data: orgMemberships, error: orgError } = await supabaseService
        .getClient()
        .from("organization_members")
        .select(
          `
          role,
          organizations (
            id,
            name,
            slug
          )
        `
        )
        .eq("user_id", user.id);

      if (orgError) {
        throw new AppError("Failed to fetch organizations", 500);
      }

      const organizations = (orgMemberships || []).map((om: any) => ({
        id: om.organizations?.id,
        name: om.organizations?.name,
        slug: om.organizations?.slug,
        role: om.role,
      }));

      // Get user's accessible apps (via app_permissions OR org admin)
      const orgIds = organizations.map((o: any) => o.id).filter(Boolean);

      let apps: any[] = [];

      // Apps from direct permissions
      const { data: directApps } = await supabaseService
        .getClient()
        .from("app_permissions")
        .select(
          `
          role,
          apps (
            id,
            app_id,
            name,
            icon_url,
            organization_id
          )
        `
        )
        .eq("user_id", user.id);

      if (directApps) {
        apps.push(
          ...directApps.map((ap: any) => ({
            id: ap.apps?.id,
            app_id: ap.apps?.app_id,
            name: ap.apps?.name,
            icon_url: ap.apps?.icon_url,
            organization_id: ap.apps?.organization_id,
            role: ap.role,
          }))
        );
      }

      // Apps from org admin/owner roles
      const adminOrgIds = organizations
        .filter((o: any) => o.role === "owner" || o.role === "admin")
        .map((o: any) => o.id)
        .filter(Boolean);

      if (adminOrgIds.length > 0) {
        const { data: orgApps } = await supabaseService
          .getClient()
          .from("apps")
          .select("id, app_id, name, icon_url, organization_id")
          .in("organization_id", adminOrgIds);

        if (orgApps) {
          // Add org apps that aren't already in the list
          const existingAppIds = new Set(apps.map((a) => a.id));
          for (const app of orgApps) {
            if (!existingAppIds.has(app.id)) {
              apps.push({
                ...app,
                role: "admin", // Org admins get admin access
              });
            }
          }
        }
      }

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
        },
        organizations,
        apps,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
